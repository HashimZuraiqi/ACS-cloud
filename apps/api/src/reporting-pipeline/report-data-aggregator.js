/**
 * Report Data Aggregator
 * 
 * Collects and normalizes all scan, remediation, compliance, and timeline data
 * into a unified report object for the PDF generator.
 */

const { docClient } = require('../config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");

class ReportDataAggregator {

    /**
     * Aggregate all data for a comprehensive security assessment report.
     * @param {string} userEmail - The user requesting the report
     * @returns {Object} Unified report data object
     */
    async aggregate(userEmail) {
        console.log(`[ReportAggregator] Building report data for ${userEmail}`);

        // Fetch all scan data in parallel
        const [s3Scans, ec2Scans, iamScans, auditLog] = await Promise.all([
            this._fetchScans("CloudGuard_Scans", userEmail),
            this._fetchScans("CloudGuard_EC2_Scans", userEmail),
            this._fetchScans("CloudGuard_IAM_Scans", userEmail),
            this._fetchAuditLog(userEmail),
        ]);

        // Deduplicate: keep only latest scan per resource
        const s3Latest = this._deduplicateScans(s3Scans, 'bucket');
        const ec2Latest = this._deduplicateScans(ec2Scans, 'instance_id');
        const iamLatest = this._deduplicateScans(iamScans, 'username');

        const allScans = [...s3Latest, ...ec2Latest, ...iamLatest];

        // Build report sections
        const report = {
            meta: {
                generated_at: new Date().toISOString(),
                user_email: userEmail,
                platform: 'CloudGuard AI Security',
                report_id: `RPT-${Date.now()}`
            },

            executive_summary: this._buildExecutiveSummary(s3Latest, ec2Latest, iamLatest, auditLog),
            infrastructure_overview: this._buildInfrastructureOverview(s3Latest, ec2Latest, iamLatest),
            vulnerabilities: this._buildVulnerabilities(allScans),
            compliance: this._buildComplianceSection(allScans),
            remediation_history: this._buildRemediationHistory(auditLog),
            security_timeline: this._buildTimeline(allScans, auditLog),
            score_summary: this._buildScoreSummary(allScans),

            // Raw data for detail sections
            raw: { s3: s3Latest, ec2: ec2Latest, iam: iamLatest, audit: auditLog }
        };

        return report;
    }

    // ─── Executive Summary ───────────────────────────────────────────

    _buildExecutiveSummary(s3, ec2, iam, audit) {
        const totalResources = s3.length + ec2.length + iam.length;
        const atRisk = [...s3, ...ec2, ...iam].filter(s => s.status === 'AT_RISK').length;
        const secure = totalResources - atRisk;
        const remediationsApplied = audit.filter(a => a.status === 'SUCCESS').length;

        const avgScore = totalResources > 0
            ? Math.round([...s3, ...ec2, ...iam].reduce((sum, s) => sum + (s.risk_score || 0), 0) / totalResources)
            : 0;

        const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        [...s3, ...ec2, ...iam].forEach(scan => {
            const sev = scan.severity || 'LOW';
            severityCounts[sev] = (severityCounts[sev] || 0) + 1;
        });

        return {
            total_resources: totalResources,
            resources_at_risk: atRisk,
            resources_secure: secure,
            security_posture: atRisk === 0 ? 'STRONG' : atRisk <= 2 ? 'MODERATE' : 'WEAK',
            average_risk_score: avgScore,
            remediations_applied: remediationsApplied,
            severity_distribution: severityCounts,
            summary_text: this._generateSummaryText(totalResources, atRisk, avgScore, remediationsApplied)
        };
    }

    _generateSummaryText(total, atRisk, avgScore, remediations) {
        if (total === 0) return 'No resources have been scanned yet.';
        let text = `CloudGuard scanned ${total} AWS resource(s). `;
        if (atRisk === 0) {
            text += 'All resources passed security checks. ';
        } else {
            text += `${atRisk} resource(s) require attention. `;
        }
        text += `Average risk score: ${avgScore}/100. `;
        if (remediations > 0) {
            text += `${remediations} remediation action(s) have been successfully applied.`;
        }
        return text;
    }

    // ─── Infrastructure Overview ─────────────────────────────────────

    _buildInfrastructureOverview(s3, ec2, iam) {
        return {
            services: [
                { name: 'S3 Buckets', count: s3.length, icon: '🪣', at_risk: s3.filter(s => s.status === 'AT_RISK').length },
                { name: 'EC2 Instances', count: ec2.length, icon: '🖥️', at_risk: ec2.filter(s => s.status === 'AT_RISK').length },
                { name: 'IAM Users', count: iam.length, icon: '👤', at_risk: iam.filter(s => s.status === 'AT_RISK').length },
            ],
            total: s3.length + ec2.length + iam.length,
            regions: this._extractRegions([...s3, ...ec2])
        };
    }

    _extractRegions(scans) {
        const regions = new Set();
        scans.forEach(s => {
            let raw = {};
            try { raw = typeof s.raw_config === 'string' ? JSON.parse(s.raw_config) : (s.raw_config || {}); } catch {}
            if (raw.region) regions.add(raw.region);
        });
        return [...regions];
    }

    // ─── Vulnerabilities ─────────────────────────────────────────────

    _buildVulnerabilities(allScans) {
        const vulns = [];
        for (const scan of allScans) {
            const resourceId = scan.bucket || scan.instance_id || scan.username;
            const findings = scan.findings || [];
            const structured = this._parseJSON(scan.structured_findings, []);

            if (structured.length > 0) {
                // Use structured findings from the rule engine
                structured.filter(f => !f.passed).forEach(f => {
                    vulns.push({
                        resource: resourceId,
                        rule_id: f.rule_id,
                        title: f.title,
                        severity: f.severity,
                        description: f.description,
                        remediation: f.remediation,
                        compliance: f.compliance || []
                    });
                });
            } else {
                // Fallback to legacy string findings
                findings.forEach(finding => {
                    vulns.push({
                        resource: resourceId,
                        rule_id: null,
                        title: finding,
                        severity: scan.severity || 'MEDIUM',
                        description: finding,
                        remediation: scan.remediation || '',
                        compliance: []
                    });
                });
            }
        }

        // Sort: CRITICAL first, then HIGH, MEDIUM, LOW
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        vulns.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

        return {
            total: vulns.length,
            by_severity: {
                critical: vulns.filter(v => v.severity === 'CRITICAL').length,
                high: vulns.filter(v => v.severity === 'HIGH').length,
                medium: vulns.filter(v => v.severity === 'MEDIUM').length,
                low: vulns.filter(v => v.severity === 'LOW').length,
            },
            items: vulns
        };
    }

    // ─── Compliance ──────────────────────────────────────────────────

    _buildComplianceSection(allScans) {
        const frameworkScores = {};

        for (const scan of allScans) {
            const compMap = this._parseJSON(scan.compliance_map, null);
            if (!compMap) continue;

            for (const [framework, data] of Object.entries(compMap)) {
                if (!frameworkScores[framework]) {
                    frameworkScores[framework] = { total_controls: 0, passing: 0, failing: 0 };
                }
                frameworkScores[framework].total_controls += (data.total_controls || 0);
                frameworkScores[framework].passing += (data.passing || 0);
                frameworkScores[framework].failing += (data.failing || 0);
            }
        }

        // Calculate percentages
        for (const fw of Object.values(frameworkScores)) {
            fw.compliance_percent = fw.total_controls > 0
                ? Math.round((fw.passing / fw.total_controls) * 100)
                : 100;
        }

        return { frameworks: frameworkScores };
    }

    // ─── Remediation History ─────────────────────────────────────────

    _buildRemediationHistory(audit) {
        const actions = audit.map(a => ({
            timestamp: a.timestamp,
            resource: a.resource_id,
            resource_type: a.resource_type,
            action: a.action,
            decision: a.decision,
            status: a.status,
            reasoning: a.reasoning
        }));

        return {
            total_actions: actions.length,
            successful: actions.filter(a => a.status === 'SUCCESS').length,
            failed: actions.filter(a => a.status === 'FAILED').length,
            skipped: actions.filter(a => a.status === 'SKIPPED').length,
            actions
        };
    }

    // ─── Security Timeline ───────────────────────────────────────────

    _buildTimeline(allScans, audit) {
        const events = [];

        // Scan events
        for (const scan of allScans) {
            const resourceId = scan.bucket || scan.instance_id || scan.username;
            const resourceType = scan.bucket ? 'S3' : scan.instance_id ? 'EC2' : 'IAM';
            events.push({
                timestamp: scan.created_at,
                type: 'SCAN',
                icon: '🔍',
                resource: resourceId,
                resource_type: resourceType,
                description: `${resourceType} scan completed — ${scan.status === 'AT_RISK' ? '⚠️ Issues found' : '✅ Secure'}`,
                risk_score: scan.risk_score,
                severity: scan.severity
            });
        }

        // Remediation events
        for (const action of audit) {
            events.push({
                timestamp: action.timestamp,
                type: action.action === 'ROLLBACK' ? 'ROLLBACK' : 'REMEDIATION',
                icon: action.action === 'ROLLBACK' ? '↩️' : '🔧',
                resource: action.resource_id,
                resource_type: action.resource_type,
                description: `${action.action} — ${action.status}`,
                decision: action.decision,
                status: action.status
            });
        }

        // Sort chronologically
        events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return events;
    }

    // ─── Score Summary ───────────────────────────────────────────────

    _buildScoreSummary(allScans) {
        const scores = allScans.map(s => ({
            resource: s.bucket || s.instance_id || s.username,
            resource_type: s.bucket ? 'S3' : s.instance_id ? 'EC2' : 'IAM',
            risk_score: s.risk_score || 0,
            severity: s.severity || 'LOW',
            status: s.status
        }));

        return {
            scores,
            average: scores.length > 0
                ? Math.round(scores.reduce((sum, s) => sum + s.risk_score, 0) / scores.length)
                : 0,
            highest: scores.length > 0
                ? scores.reduce((max, s) => s.risk_score > max.risk_score ? s : max, scores[0])
                : null
        };
    }

    // ─── Data Fetchers ───────────────────────────────────────────────

    async _fetchScans(tableName, userEmail) {
        try {
            const response = await docClient.send(new ScanCommand({
                TableName: tableName,
                FilterExpression: "user_email = :email",
                ExpressionAttributeValues: { ":email": userEmail }
            }));
            return response.Items || [];
        } catch (err) {
            console.warn(`[ReportAggregator] Could not fetch ${tableName}: ${err.message}`);
            return [];
        }
    }

    async _fetchAuditLog(userEmail) {
        try {
            const response = await docClient.send(new ScanCommand({
                TableName: "CloudGuard_Remediation_Audit",
                FilterExpression: "user_email = :email",
                ExpressionAttributeValues: { ":email": userEmail }
            }));
            return (response.Items || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (err) {
            console.warn(`[ReportAggregator] Could not fetch audit log: ${err.message}`);
            return [];
        }
    }

    _deduplicateScans(scans, key) {
        const map = new Map();
        scans.forEach(scan => {
            const existing = map.get(scan[key]);
            if (!existing || new Date(scan.created_at) > new Date(existing.created_at)) {
                map.set(scan[key], scan);
            }
        });
        return Array.from(map.values());
    }

    _parseJSON(val, fallback) {
        if (!val) return fallback;
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch { return fallback; }
    }
}

module.exports = new ReportDataAggregator();
