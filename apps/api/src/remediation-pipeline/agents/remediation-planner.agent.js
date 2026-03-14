const decisionEngine = require('./remediation-decision-engine');
const impactAnalyzer = require('./impact-analyzer');
const riskScorer = require('../../scan-pipeline/agents/risk-scorer.agent');
const assistedFixGenerator = require('./assisted-fix.agent');

class RemediationPlannerAgent {

    /**
     * Generate an S3 remediation plan with smart decision classification.
     * Each step includes: action, decision, impact, reasoning, and reversibility.
     */
    createPlan(scanResult) {
        console.log(`[RemediationPlanner] Generating S3 plan for: ${scanResult.bucket}`);

        const rawConfig = this._parseRawConfig(scanResult.raw_config);
        const steps = [];
        const findings = scanResult.findings || [];
        const structuredFindings = this._getStructuredFindings(scanResult);
        const findingsStr = JSON.stringify(findings).toLowerCase();

        // Map findings to remediation actions
        const actionMappings = [
            {
                check: () => findingsStr.includes("public access") || findingsStr.includes("public acl") || findingsStr.includes("alluser")
                    || structuredFindings.some(f => f.rule_id === 'S3-001'),
                action: "PUT_PUBLIC_ACCESS_BLOCK",
                description: "Enable Block Public Access",
                matchingRule: structuredFindings.find(f => f.rule_id === 'S3-001')
            },
            {
                check: () => findingsStr.includes("acl") || findingsStr.includes("alluser") || findingsStr.includes("authenticateduser")
                    || structuredFindings.some(f => ['S3-002', 'S3-003'].includes(f.rule_id)),
                action: "REMOVE_PUBLIC_ACLS",
                description: "Set bucket ACL to private",
                matchingRule: structuredFindings.find(f => f.rule_id === 'S3-002' || f.rule_id === 'S3-003')
            },
            {
                check: () => findingsStr.includes("policy") || findingsStr.includes("principal") || findingsStr.includes("wildcard")
                    || structuredFindings.some(f => f.rule_id === 'S3-004'),
                action: "SANITIZE_BUCKET_POLICY",
                description: "Remove wildcard principal Allow statements",
                matchingRule: structuredFindings.find(f => f.rule_id === 'S3-004')
            },
            {
                check: () => findingsStr.includes("encrypt") || findingsStr.includes("not_configured") || findingsStr.includes("sse")
                    || structuredFindings.some(f => f.rule_id === 'S3-006'),
                action: "ENABLE_ENCRYPTION",
                description: "Enable SSE-S3 (AES256) encryption",
                matchingRule: structuredFindings.find(f => f.rule_id === 'S3-006')
            },
            {
                check: () => structuredFindings.some(f => f.rule_id === 'S3-008'),
                action: "ENABLE_VERSIONING",
                description: "Enable bucket versioning",
                matchingRule: structuredFindings.find(f => f.rule_id === 'S3-008')
            },
            {
                check: () => structuredFindings.some(f => f.rule_id === 'S3-009'),
                action: "ENABLE_LOGGING",
                description: "Enable S3 access logging",
                matchingRule: structuredFindings.find(f => f.rule_id === 'S3-009')
            },
            {
                check: () => structuredFindings.some(f => f.rule_id === 'S3-010'),
                action: "ENABLE_LIFECYCLE",
                description: "Create default storage lifecycle rules",
                matchingRule: structuredFindings.find(f => f.rule_id === 'S3-010')
            },
        ];

        const processedRuleIds = new Set();
        const region = rawConfig.region || 'us-east-1';

        for (const mapping of actionMappings) {
            if (!mapping.check()) continue;

            const finding = mapping.matchingRule || {
                rule_id: 'LEGACY',
                title: mapping.description,
                severity: 'MEDIUM',
                confidence: 0.8
            };

            const decision = decisionEngine.classify({
                finding,
                rawConfig,
                action: mapping.action,
                resourceType: 'S3'
            });

            processedRuleIds.add(finding.rule_id);
            let assistedFix = null;
            if (decision.decision === 'ASSISTED_FIX') {
               assistedFix = assistedFixGenerator.generateForFinding(finding.rule_id, scanResult.bucket, region);
            }

            steps.push({
                action: mapping.action,
                description: mapping.description,
                decision: decision.decision,
                reasoning: decision.reasoning,
                confidence: decision.confidence,
                risk_of_change: decision.risk_of_change,
                reversible: decision.reversible,
                rule_id: finding.rule_id,
                severity: finding.severity,
                ui_display: decision.ui_display,
                assisted_fix: assistedFix
            });
        }

        // Process any remaining findings that don't have an automated action mapping
        for (const finding of structuredFindings) {
            if (processedRuleIds.has(finding.rule_id)) continue;
            
            const decision = decisionEngine.classify({
                finding,
                rawConfig,
                action: 'MANUAL_REMEDIATION',
                resourceType: 'S3'
            });

            let assistedFix = null;
            if (decision.decision === 'ASSISTED_FIX') {
               assistedFix = assistedFixGenerator.generateForFinding(finding.rule_id, scanResult.bucket, region);
            }

            steps.push({
                action: 'MANUAL_REMEDIATION',
                description: finding.title,
                decision: decision.decision,
                reasoning: decision.reasoning,
                confidence: decision.confidence,
                risk_of_change: decision.risk_of_change,
                reversible: decision.reversible,
                rule_id: finding.rule_id,
                severity: finding.severity,
                ui_display: decision.ui_display,
                assisted_fix: assistedFix
            });
        }

        const autoFixCount = steps.filter(s => s.decision === 'AUTO_FIX').length;

        // Predict risk score by removing auto-fixed findings
        const currentScore = scanResult.risk_score || 0;
        const autoFixRuleIds = steps.filter(s => s.decision === 'AUTO_FIX').map(s => s.rule_id);
        const remainingFindings = structuredFindings.filter(f => !autoFixRuleIds.includes(f.rule_id));
        const predictedScoreResult = riskScorer.calculateWeighted(remainingFindings, rawConfig, scanResult);
        const predictedScore = predictedScoreResult.score;

        let status = "PENDING_APPROVAL";
        if (autoFixCount === 0) {
            status = "NO_ACTION_NEEDED";
        } else if (predictedScore >= currentScore) {
            status = "BLOCKED";
        }

        const plan = {
            plan_id: `plan_s3_${Date.now()}`,
            service: "s3",
            resource: scanResult.bucket,
            status: status,
            steps,
            summary: {
                total_steps: steps.length,
                auto_fix: autoFixCount,
                suggest_fix: steps.filter(s => s.decision === 'SUGGEST_FIX').length,
                intentional_skip: steps.filter(s => s.decision === 'INTENTIONAL_SKIP').length,
                current_risk_score: currentScore,
                predicted_risk_score: predictedScore
            }
        };

        // Add impact analysis
        const impactReport = impactAnalyzer.analyze(plan, rawConfig, 'S3');
        plan.impact = impactReport;

        return plan;
    }

    /**
     * Generate an EC2 remediation plan with smart decision classification.
     */
    createEC2Plan(scanResult) {
        const instanceId = scanResult.instance_id;
        console.log(`[RemediationPlanner] Generating EC2 plan for: ${instanceId}`);

        const rawConfig = this._parseRawConfig(scanResult.raw_config);
        const steps = [];
        const findings = scanResult.findings || [];
        const structuredFindings = this._getStructuredFindings(scanResult);
        const findingsStr = JSON.stringify(findings).toLowerCase();

        const actionMappings = [
            {
                check: () => this._hasOpenPort(rawConfig, 22) || findingsStr.includes("ssh") || findingsStr.includes("port 22")
                    || structuredFindings.some(f => f.rule_id === 'EC2-002'),
                action: "RESTRICT_SSH",
                description: "Revoke SSH (port 22) access from 0.0.0.0/0",
                matchingRule: structuredFindings.find(f => f.rule_id === 'EC2-002')
            },
            {
                check: () => this._hasOpenDangerousPorts(rawConfig) || findingsStr.includes("all inbound") || findingsStr.includes("rdp")
                    || structuredFindings.some(f => ['EC2-003', 'EC2-004', 'EC2-005'].includes(f.rule_id)),
                action: "RESTRICT_SECURITY_GROUPS",
                description: "Revoke dangerous public inbound rules (RDP, databases, all-traffic)",
                matchingRule: structuredFindings.find(f => ['EC2-003', 'EC2-004', 'EC2-005'].includes(f.rule_id))
            },
            {
                check: () => !rawConfig.imdsv2_required || structuredFindings.some(f => f.rule_id === 'EC2-006'),
                action: "ENFORCE_IMDSV2",
                description: "Enforce IMDSv2 (set HttpTokens to 'required')",
                matchingRule: structuredFindings.find(f => f.rule_id === 'EC2-006')
            },
            {
                check: () => !rawConfig.monitoring_enabled || structuredFindings.some(f => f.rule_id === 'EC2-009'),
                action: "ENABLE_MONITORING",
                description: "Enable detailed CloudWatch monitoring",
                matchingRule: structuredFindings.find(f => f.rule_id === 'EC2-009')
            },
            {
                check: () => (rawConfig.ebs_volumes || []).some(v => !v.encrypted)
                    || structuredFindings.some(f => f.rule_id === 'EC2-007'),
                action: "ENCRYPT_EBS_VOLUMES",
                description: "Encrypt unencrypted EBS volumes (manual — requires snapshot+copy)",
                matchingRule: structuredFindings.find(f => f.rule_id === 'EC2-007')
            },
        ];

        const processedRuleIds = new Set();
        const region = rawConfig.region || 'us-east-1';

        for (const mapping of actionMappings) {
            if (!mapping.check()) continue;

            const finding = mapping.matchingRule || {
                rule_id: 'LEGACY',
                title: mapping.description,
                severity: 'MEDIUM',
                confidence: 0.8
            };

            const decision = decisionEngine.classify({
                finding,
                rawConfig,
                action: mapping.action,
                resourceType: 'EC2'
            });

            processedRuleIds.add(finding.rule_id);
            let assistedFix = null;
            if (decision.decision === 'ASSISTED_FIX') {
               assistedFix = assistedFixGenerator.generateForFinding(finding.rule_id, instanceId, region);
            }

            steps.push({
                action: mapping.action,
                description: mapping.description,
                decision: decision.decision,
                reasoning: decision.reasoning,
                confidence: decision.confidence,
                risk_of_change: decision.risk_of_change,
                reversible: decision.reversible,
                rule_id: finding.rule_id,
                severity: finding.severity,
                ui_display: decision.ui_display,
                assisted_fix: assistedFix
            });
        }
        
        // Process any remaining findings that don't have an automated action mapping
        for (const finding of structuredFindings) {
            if (processedRuleIds.has(finding.rule_id)) continue;
            
            const decision = decisionEngine.classify({
                finding,
                rawConfig,
                action: 'MANUAL_REMEDIATION',
                resourceType: 'EC2'
            });

            let assistedFix = null;
            if (decision.decision === 'ASSISTED_FIX') {
               assistedFix = assistedFixGenerator.generateForFinding(finding.rule_id, instanceId, region);
            }

            steps.push({
                action: 'MANUAL_REMEDIATION',
                description: finding.title,
                decision: decision.decision,
                reasoning: decision.reasoning,
                confidence: decision.confidence,
                risk_of_change: decision.risk_of_change,
                reversible: decision.reversible,
                rule_id: finding.rule_id,
                severity: finding.severity,
                ui_display: decision.ui_display,
                assisted_fix: assistedFix
            });
        }

        const autoFixCount = steps.filter(s => s.decision === 'AUTO_FIX').length;

        const currentScore = scanResult.risk_score || 0;
        const autoFixRuleIds = steps.filter(s => s.decision === 'AUTO_FIX').map(s => s.rule_id);
        const remainingFindings = structuredFindings.filter(f => !autoFixRuleIds.includes(f.rule_id));
        const predictedScoreResult = riskScorer.calculateWeighted(remainingFindings, rawConfig, scanResult);
        const predictedScore = predictedScoreResult.score;

        let status = "PENDING_APPROVAL";
        if (autoFixCount === 0) {
            status = "NO_ACTION_NEEDED";
        } else if (predictedScore >= currentScore) {
            status = "BLOCKED";
        }

        const plan = {
            plan_id: `plan_ec2_${Date.now()}`,
            service: "ec2",
            resource: instanceId,
            status: status,
            steps,
            summary: {
                total_steps: steps.length,
                auto_fix: autoFixCount,
                suggest_fix: steps.filter(s => s.decision === 'SUGGEST_FIX').length,
                intentional_skip: steps.filter(s => s.decision === 'INTENTIONAL_SKIP').length,
                current_risk_score: currentScore,
                predicted_risk_score: predictedScore
            }
        };

        const impactReport = impactAnalyzer.analyze(plan, rawConfig, 'EC2');
        plan.impact = impactReport;

        return plan;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    _parseRawConfig(rawConfig) {
        if (!rawConfig) return {};
        if (typeof rawConfig === 'string') {
            try { return JSON.parse(rawConfig); } catch { return {}; }
        }
        return rawConfig;
    }

    _getStructuredFindings(scanResult) {
        if (scanResult.structured_findings) {
            const parsed = typeof scanResult.structured_findings === 'string'
                ? JSON.parse(scanResult.structured_findings)
                : scanResult.structured_findings;
            return Array.isArray(parsed) ? parsed : [];
        }
        return [];
    }

    _hasOpenPort(rawConfig, targetPort) {
        if (!rawConfig.security_groups || !Array.isArray(rawConfig.security_groups)) return false;
        for (const sg of rawConfig.security_groups) {
            for (const rule of (sg.inbound_rules || [])) {
                const hasOpenCidr = (rule.ip_ranges || []).includes("0.0.0.0/0") ||
                    (rule.ipv6_ranges || []).includes("::/0");
                if (!hasOpenCidr) continue;
                if (rule.protocol === "-1") return true;
                if (rule.from_port !== undefined && rule.to_port !== undefined &&
                    rule.from_port <= targetPort && rule.to_port >= targetPort) return true;
            }
        }
        return false;
    }

    _hasOpenDangerousPorts(rawConfig) {
        const dangerousPorts = [3389, 3306, 5432, 1433, 27017, 6379];
        if (!rawConfig.security_groups || !Array.isArray(rawConfig.security_groups)) return false;
        for (const sg of rawConfig.security_groups) {
            for (const rule of (sg.inbound_rules || [])) {
                const hasOpenCidr = (rule.ip_ranges || []).includes("0.0.0.0/0") ||
                    (rule.ipv6_ranges || []).includes("::/0");
                if (!hasOpenCidr) continue;
                if (rule.protocol === "-1") return true;
                for (const port of dangerousPorts) {
                    if (rule.from_port <= port && rule.to_port >= port) return true;
                }
            }
        }
        return false;
    }
}

module.exports = new RemediationPlannerAgent();
