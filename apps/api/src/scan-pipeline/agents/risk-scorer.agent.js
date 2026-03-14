/**
 * Weighted Multi-Factor Risk Scorer
 * 
 * Replaces the original passthrough scorer with a composite algorithm that factors in:
 *   - Base Severity  (0.30) — Intrinsic severity of the worst finding
 *   - Exploitability  (0.25) — How easily can an attacker exploit this?
 *   - Blast Radius    (0.20) — What's the damage if exploited?
 *   - Exposure        (0.15) — Is the resource internet-facing?
 *   - Compensating    (0.10) — Are there mitigating controls?
 * 
 * The legacy `calculate()` method is kept for backward compat but now delegates to `calculateWeighted`.
 */

const SEVERITY_SCORES = { CRITICAL: 95, HIGH: 75, MEDIUM: 50, LOW: 25, INFO: 10 };

const WEIGHTS = {
    baseSeverity: 0.30,
    exploitability: 0.25,
    blastRadius: 0.20,
    exposure: 0.15,
    compensatingControls: 0.10
};

class RiskScorerAgent {

    /**
     * Legacy interface — kept for backward compatibility.
     * Controllers that haven't been updated yet can still call this.
     */
    calculate(analysisResult) {
        console.log(`[RiskScorer] Calculating score based on analysis...`);

        // If the new pipeline provides findings array, use the weighted algorithm
        if (analysisResult.findings && Array.isArray(analysisResult.findings)) {
            return this.calculateWeighted(analysisResult.findings, analysisResult.rawConfig || {}, analysisResult);
        }

        // Fallback: legacy behavior for old-style analysis objects
        const score = analysisResult.risk_score || 0;
        let severity = 'LOW';
        if (score >= 80) severity = 'CRITICAL';
        else if (score >= 60) severity = 'HIGH';
        else if (score >= 30) severity = 'MEDIUM';

        return {
            score,
            severity,
            category: analysisResult.is_public || analysisResult.is_publicly_exposed ? 'Public Exposure' : 'Configuration',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * New weighted multi-factor scoring algorithm.
     * @param {Array} findings - Array of finding objects from rule engine
     * @param {Object} rawConfig - Raw resource configuration from scanner
     * @param {Object} analysisResult - Full analysis result (optional, for additional context)
     * @returns {{ score, severity, factors, breakdown, category, timestamp }}
     */
    calculateWeighted(findings, rawConfig = {}, analysisResult = {}) {
        console.log(`[RiskScorer] Calculating weighted score for ${findings.length} finding(s)...`);

        const failedFindings = findings.filter(f => !f.passed);

        if (failedFindings.length === 0) {
            return {
                score: 0,
                severity: 'LOW',
                category: 'Secure',
                factors: this._emptyFactors(),
                breakdown: [],
                timestamp: new Date().toISOString()
            };
        }

        // Factor 1: Base Severity — weighted average of all finding severities
        const baseSeverity = this._computeBaseSeverity(failedFindings);

        // Factor 2: Exploitability — how easy is it to exploit?
        const exploitability = this._computeExploitability(failedFindings, rawConfig);

        // Factor 3: Blast Radius — what's the potential damage?
        const blastRadius = this._computeBlastRadius(failedFindings, rawConfig);

        // Factor 4: Exposure — is the resource internet-facing?
        const exposure = this._computeExposure(failedFindings, rawConfig);

        // Factor 5: Compensating Controls — mitigating factors
        const compensating = this._computeCompensatingControls(rawConfig);

        // Compute weighted score
        const rawScore =
            (baseSeverity * WEIGHTS.baseSeverity) +
            (exploitability * WEIGHTS.exploitability) +
            (blastRadius * WEIGHTS.blastRadius) +
            (exposure * WEIGHTS.exposure) -
            (compensating * WEIGHTS.compensatingControls);

        const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

        let severity = 'LOW';
        if (finalScore >= 80) severity = 'CRITICAL';
        else if (finalScore >= 60) severity = 'HIGH';
        else if (finalScore >= 30) severity = 'MEDIUM';

        const category = this._determineCategory(failedFindings, rawConfig);

        return {
            score: finalScore,
            severity,
            category,
            factors: {
                base_severity: { value: baseSeverity, weight: WEIGHTS.baseSeverity },
                exploitability: { value: exploitability, weight: WEIGHTS.exploitability },
                blast_radius: { value: blastRadius, weight: WEIGHTS.blastRadius },
                exposure: { value: exposure, weight: WEIGHTS.exposure },
                compensating_controls: { value: compensating, weight: WEIGHTS.compensatingControls }
            },
            breakdown: failedFindings.map(f => ({
                rule_id: f.rule_id,
                title: f.title,
                severity: f.severity,
                base_score: SEVERITY_SCORES[f.severity] || 50
            })),
            timestamp: new Date().toISOString()
        };
    }

    // ─── Factor Computation Methods ──────────────────────────────────

    _computeBaseSeverity(findings) {
        if (findings.length === 0) return 0;

        // Separate exploitable findings from recommendation-only findings
        const RECOMMENDATION_MODES = new Set(['MANUAL_REVIEW', 'ASSISTED_FIX', 'MANUAL_RECOMMENDATION', 'INFORMATIONAL']);
        const RECOMMENDATION_RULES = new Set(['S3-007', 'S3-011', 'S3-012']); // SSE-KMS upgrade, CORS, cross-account

        const exploitable = findings.filter(f => {
            const mode = f.remediation_mode || f.remediationMode || '';
            return !RECOMMENDATION_MODES.has(mode) && !RECOMMENDATION_RULES.has(f.rule_id);
        });
        const recommendations = findings.filter(f => {
            const mode = f.remediation_mode || f.remediationMode || '';
            return RECOMMENDATION_MODES.has(mode) || RECOMMENDATION_RULES.has(f.rule_id);
        });

        // Exploitable findings: full severity scoring
        if (exploitable.length > 0) {
            const scores = exploitable.map(f => SEVERITY_SCORES[f.severity] || 50).sort((a, b) => b - a);
            const maxScore = scores[0];
            let additionalPenalty = 0;
            for (let i = 1; i < scores.length; i++) {
                additionalPenalty += (scores[i] * 0.10);
            }
            // Recommendations add minimal weight (2% of their severity)
            let recoPenalty = 0;
            for (const r of recommendations) {
                recoPenalty += ((SEVERITY_SCORES[r.severity] || 25) * 0.02);
            }
            return Math.round(Math.min(100, maxScore + additionalPenalty + recoPenalty));
        }

        // Only recommendation findings remain — score should be very low
        if (recommendations.length > 0) {
            let recoScore = 0;
            for (const r of recommendations) {
                recoScore += ((SEVERITY_SCORES[r.severity] || 25) * 0.05);
            }
            return Math.round(Math.min(30, recoScore)); // Cap at 30 for recommendation-only
        }

        return 0;
    }

    _computeExploitability(findings, rawConfig) {
        let score = 30; // baseline

        // Only count exploitable findings (not recommendations)
        const exploitable = findings.filter(f => !this._isRecommendationOnly(f));

        // Check for publicly-exploitable findings
        const hasCriticalPublicExposure = exploitable.some(f =>
            f.rule_id === 'S3-002' || f.rule_id === 'S3-004' ||
            f.rule_id === 'EC2-002' || f.rule_id === 'EC2-003' || f.rule_id === 'EC2-004'
        );
        if (hasCriticalPublicExposure) score += 40;

        // IMDSv1 + public IP = SSRF chain
        const hasIMDSv1 = exploitable.some(f => f.rule_id === 'EC2-006');
        const hasPublicIP = !!rawConfig.public_ip;
        if (hasIMDSv1 && hasPublicIP) score += 25;

        // Admin access without MFA
        const hasAdmin = exploitable.some(f => f.rule_id === 'IAM-001');
        const noMFA = exploitable.some(f => f.rule_id === 'IAM-003');
        if (hasAdmin && noMFA) score += 20;

        // If only recommendations remain, lower baseline
        if (exploitable.length === 0) return 10;

        return Math.min(100, score);
    }

    _computeBlastRadius(findings, rawConfig) {
        let score = 20; // baseline

        const exploitable = findings.filter(f => !this._isRecommendationOnly(f));

        // Sensitive resource naming patterns
        const name = rawConfig.bucket || rawConfig.instance_id || rawConfig.username || '';
        if (/prod|production|customer|payment|pii|backup|database/i.test(name)) {
            score += 30;
        }

        // Admin access = full account blast radius
        if (exploitable.some(f => f.rule_id === 'IAM-001' || f.rule_id === 'IAM-002')) {
            score += 40;
        }

        // Multiple critical findings compound the blast radius
        const criticals = exploitable.filter(f => f.severity === 'CRITICAL');
        score += Math.min(30, criticals.length * 15);

        // If only recommendations remain, lower baseline
        if (exploitable.length === 0) return 10;

        return Math.min(100, score);
    }

    _computeExposure(findings, rawConfig) {
        let score = 10; // baseline for any resource

        const exploitable = findings.filter(f => !this._isRecommendationOnly(f));

        // S3: Check for public access patterns
        if (rawConfig.bucket) {
            const isPub = exploitable.some(f =>
                f.rule_id === 'S3-001' || f.rule_id === 'S3-002' || f.rule_id === 'S3-004'
            );
            if (isPub) score += 60;

            // No encryption on exposed bucket
            const noEncrypt = exploitable.some(f => f.rule_id === 'S3-006');
            if (isPub && noEncrypt) score += 20;
        }

        // EC2: Public IP + open SG = high exposure
        if (rawConfig.instance_id) {
            if (rawConfig.public_ip) score += 40;
            const openSG = exploitable.some(f =>
                ['EC2-002', 'EC2-003', 'EC2-004', 'EC2-005'].includes(f.rule_id)
            );
            if (openSG) score += 30;
        }

        // IAM: Admin users are inherently high exposure
        if (rawConfig.username && rawConfig.has_admin_access) {
            score += 50;
        }

        // If only recommendations remain, lower baseline
        if (exploitable.length === 0) return 5;

        return Math.min(100, score);
    }

    _computeCompensatingControls(rawConfig) {
        let score = 0;

        // S3 compensating controls
        if (rawConfig.bucket) {
            const pab = rawConfig.public_access_block || {};
            const pabCount = [pab.BlockPublicAcls, pab.IgnorePublicAcls, pab.BlockPublicPolicy, pab.RestrictPublicBuckets]
                .filter(Boolean).length;
            score += pabCount * 5; // Some PAB enabled (even if not all)

            if (rawConfig.encryption && rawConfig.encryption !== 'NOT_CONFIGURED') score += 10;
            if (rawConfig.versioning?.Status === 'Enabled') score += 5;
            if (rawConfig.logging?.LoggingEnabled) score += 5;
        }

        // EC2 compensating controls
        if (rawConfig.instance_id) {
            if (rawConfig.imdsv2_required) score += 15;
            if (rawConfig.iam_profile) score += 10;
            if (rawConfig.monitoring_enabled) score += 5;
            if (!rawConfig.public_ip) score += 20; // No public IP = major mitigant
            if (rawConfig.vpc_flow_logs_enabled) score += 5;
        }

        // IAM compensating controls
        if (rawConfig.username) {
            if (rawConfig.mfa_enabled) score += 20;
            if (!rawConfig.has_admin_access) score += 15;
        }

        return Math.min(100, score);
    }

    _determineCategory(findings, rawConfig) {
        const hasPublicExposure = findings.some(f =>
            ['S3-002', 'S3-004', 'EC2-002', 'EC2-003', 'EC2-004'].includes(f.rule_id)
        );
        if (hasPublicExposure) return 'Public Exposure';

        const hasIdentity = findings.some(f => f.rule_id?.startsWith('IAM'));
        if (hasIdentity) return 'Identity & Access';

        const hasEncryption = findings.some(f =>
            ['S3-006', 'S3-007', 'EC2-007'].includes(f.rule_id)
        );
        if (hasEncryption) return 'Data Protection';

        const hasNetwork = findings.some(f =>
            f.rule_id?.startsWith('EC2') && ['EC2-001', 'EC2-010', 'EC2-011', 'EC2-012'].includes(f.rule_id)
        );
        if (hasNetwork) return 'Network Security';

        return 'Configuration';
    }

    _emptyFactors() {
        return {
            base_severity: { value: 0, weight: WEIGHTS.baseSeverity },
            exploitability: { value: 0, weight: WEIGHTS.exploitability },
            blast_radius: { value: 0, weight: WEIGHTS.blastRadius },
            exposure: { value: 0, weight: WEIGHTS.exposure },
            compensating_controls: { value: 0, weight: WEIGHTS.compensatingControls }
        };
    }

    _isRecommendationOnly(finding) {
        const RECOMMENDATION_MODES = new Set(['MANUAL_REVIEW', 'ASSISTED_FIX', 'MANUAL_RECOMMENDATION', 'INFORMATIONAL']);
        const RECOMMENDATION_RULES = new Set(['S3-007', 'S3-011', 'S3-012']);
        const mode = finding.remediation_mode || finding.remediationMode || '';
        return RECOMMENDATION_MODES.has(mode) || RECOMMENDATION_RULES.has(finding.rule_id);
    }
}

module.exports = new RiskScorerAgent();
