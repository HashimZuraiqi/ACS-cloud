const iamRules = require('./rules/iam-rules');
const evidenceChain = require('./evidence-chain');
const { mapFindings } = require('./rules/compliance-frameworks');

class IAMComplianceReasoner {
    /**
     * Analyze an IAM user's configuration using the enhanced pipeline:
     * 1. Rule Engine → deterministic findings
     * 2. Evidence Chain → audit trail
     * 3. Compliance Mapping → per-framework results
     * 
     * NOTE: IAM reasoner stays deterministic (no Bedrock call) since
     * IAM checks are primarily boolean/threshold-based and don't benefit
     * as much from LLM contextual analysis.
     */
    async analyze(rawConfig) {
        console.log(`[IAMComplianceReasoner] Analyzing user: ${rawConfig.username}`);

        // ── Stage 1: Deterministic Rule Engine ───────────────────────
        const ruleResults = iamRules.evaluate(rawConfig);
        console.log(`[IAMComplianceReasoner] Rule engine: ${ruleResults.failed} finding(s) out of ${ruleResults.total_rules} rules`);

        // ── Stage 2: Evidence chains ────────────────────────────────
        const evidenceChains = evidenceChain.build({
            rawConfig,
            ruleResults,
            aiResult: null,
            resourceType: 'IAM'
        });

        // ── Stage 3: Compliance mapping ─────────────────────────────
        const complianceMap = mapFindings(ruleResults.findings);

        // ── Build response ──────────────────────────────────────────
        const failedFindings = ruleResults.findings.filter(f => !f.passed);

        // Determine compliance status and severity
        const worstSeverity = failedFindings.reduce((worst, f) => {
            const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            return (order[f.severity] || 0) > (order[worst] || 0) ? f.severity : worst;
        }, 'LOW');
        const severityScores = { CRITICAL: 95, HIGH: 75, MEDIUM: 50, LOW: 25 };

        const analysis = {
            compliance_status: failedFindings.length > 0 ? "NON_COMPLIANT" : "COMPLIANT",
            violations: failedFindings.map(f => f.description || f.title),
            reasoning: this._buildReasoning(rawConfig, failedFindings),
            remediation_suggestion: this._buildRemediation(failedFindings),
            severity: failedFindings.length > 0 ? worstSeverity : 'LOW',
            score: failedFindings.length > 0 ? severityScores[worstSeverity] || 50 : 10,

            // ── Enhanced fields ──────────────────────────────────────
            findings: ruleResults.findings,
            evidence_chains: evidenceChains,
            compliance_map: complianceMap,
            rule_summary: {
                total_rules: ruleResults.total_rules,
                passed: ruleResults.passed,
                failed: ruleResults.failed
            },
            ai_available: false,
            rawConfig: rawConfig
        };

        return analysis;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    _buildReasoning(rawConfig, findings) {
        if (findings.length === 0) {
            return `User ${rawConfig.username} follows basic least-privilege boundaries. All IAM security checks passed.`;
        }

        const criticals = findings.filter(f => f.severity === 'CRITICAL');
        const highs = findings.filter(f => f.severity === 'HIGH');

        let reasoning = `User ${rawConfig.username}: found ${findings.length} security issue(s). `;
        if (criticals.length > 0) reasoning += `${criticals.length} CRITICAL (${criticals.map(f => f.rule_id).join(', ')}). `;
        if (highs.length > 0) reasoning += `${highs.length} HIGH (${highs.map(f => f.rule_id).join(', ')}). `;

        return reasoning.trim();
    }

    _buildRemediation(findings) {
        if (findings.length === 0) return 'No immediate action required.';
        return findings.map(f => `[${f.rule_id}] ${f.remediation}`).join(' | ');
    }
}

module.exports = new IAMComplianceReasoner();
