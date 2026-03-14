/**
 * Report Controller
 * 
 * API endpoints for generating and downloading security assessment reports.
 */

const reportAggregator = require('./report-data-aggregator');
const pdfGenerator = require('./pdf-report-generator');
const { docClient } = require('../config/db');
const { GetCommand } = require("@aws-sdk/lib-dynamodb");

/**
 * Generate and download a PDF Security Assessment Report.
 * GET /api/reports/download
 */
exports.downloadReport = async (req, res) => {
    try {
        console.log(`[ReportController] Generating report for ${req.user.email}`);

        // 1. Aggregate all data
        const reportData = await reportAggregator.aggregate(req.user.email);

        // 2. Generate PDF
        const pdfBuffer = await pdfGenerator.generate(reportData);

        // 3. Send as downloadable file
        const filename = `CloudGuard_Security_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

        console.log(`[ReportController] Report sent: ${filename} (${pdfBuffer.length} bytes)`);
    } catch (err) {
        console.error("[ReportController] Report generation failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get report data as JSON (for frontend rendering).
 * GET /api/reports/data
 */
exports.getReportData = async (req, res) => {
    try {
        const reportData = await reportAggregator.aggregate(req.user.email);
        res.json(reportData);
    } catch (err) {
        console.error("[ReportController] Report data fetch failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get just the security timeline.
 * GET /api/reports/timeline
 */
exports.getTimeline = async (req, res) => {
    try {
        const reportData = await reportAggregator.aggregate(req.user.email);
        res.json({
            timeline: reportData.security_timeline,
            count: reportData.security_timeline.length
        });
    } catch (err) {
        console.error("[ReportController] Timeline fetch failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get executive summary only (for dashboard widgets).
 * GET /api/reports/summary
 */
exports.getSummary = async (req, res) => {
    try {
        const reportData = await reportAggregator.aggregate(req.user.email);
        res.json({
            executive_summary: reportData.executive_summary,
            infrastructure: reportData.infrastructure_overview,
            score_summary: reportData.score_summary
        });
    } catch (err) {
        console.error("[ReportController] Summary fetch failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Fix #4: Download PDF report for a single resource (S3 bucket by scan ID).
 * GET /api/reports/download-resource?scanId=xxx&service=s3
 */
exports.downloadResourceReport = async (req, res) => {
    try {
        const { scanId, service } = req.query;
        if (!scanId) return res.status(400).json({ error: 'scanId is required' });

        const tableName = service === 'ec2' ? 'CloudGuard_EC2_Scans' : 'CloudGuard_Scans';
        const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { scan_id: scanId } }));
        if (!result.Item) return res.status(404).json({ error: 'Scan not found' });

        const scan = result.Item;
        const resourceName = scan.bucket || scan.instance_id || scan.username;

        // Build a single-resource report data object
        const singleReport = {
            meta: {
                generated_at: new Date().toISOString(),
                user_email: req.user.email,
                platform: 'CloudGuard AI Security',
                report_id: `RPT-${scanId.substring(0, 8)}`
            },
            executive_summary: {
                total_resources: 1,
                resources_at_risk: scan.status === 'AT_RISK' ? 1 : 0,
                resources_secure: scan.status === 'SECURE' ? 1 : 0,
                security_posture: scan.status === 'SECURE' ? 'STRONG' : 'WEAK',
                average_risk_score: scan.risk_score || 0,
                remediations_applied: 0,
                severity_distribution: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, [scan.severity || 'LOW']: 1 },
                summary_text: `Security assessment for ${resourceName}. Risk score: ${scan.risk_score || 0}/100. Status: ${scan.status}.`
            },
            infrastructure_overview: {
                services: [
                    { name: service === 'ec2' ? 'EC2 Instances' : 'S3 Buckets', count: 1, icon: service === 'ec2' ? '🖥️' : '🪣', at_risk: scan.status === 'AT_RISK' ? 1 : 0 }
                ],
                total: 1,
                regions: []
            },
            vulnerabilities: _buildVulns(scan),
            compliance: _buildCompliance(scan),
            remediation_history: { total_actions: 0, successful: 0, failed: 0, skipped: 0, actions: [] },
            security_timeline: [
                { timestamp: scan.created_at, type: 'SCAN', icon: '🔍', resource: resourceName, resource_type: service?.toUpperCase() || 'S3', description: `Scan completed — ${scan.status}`, risk_score: scan.risk_score, severity: scan.severity }
            ],
            score_summary: {
                scores: [{ resource: resourceName, resource_type: service?.toUpperCase() || 'S3', risk_score: scan.risk_score || 0, severity: scan.severity || 'LOW', status: scan.status }],
                average: scan.risk_score || 0,
                highest: { resource: resourceName, risk_score: scan.risk_score || 0 }
            },
            raw: { s3: [], ec2: [], iam: [], audit: [] }
        };

        const pdfBuffer = await pdfGenerator.generate(singleReport);
        const filename = `cloudguard-security-report-${resourceName}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (err) {
        console.error("[ReportController] Resource report failed:", err);
        res.status(500).json({ error: err.message });
    }
};

// Helper: build vulns section from single scan
function _buildVulns(scan) {
    const items = [];
    try {
        const structured = typeof scan.structured_findings === 'string' ? JSON.parse(scan.structured_findings) : (scan.structured_findings || []);
        structured.filter(f => !f.passed).forEach(f => {
            items.push({ resource: scan.bucket || scan.instance_id || '', rule_id: f.rule_id, title: f.title, severity: f.severity, description: f.description, remediation: f.remediation, compliance: f.compliance || [] });
        });
    } catch { }
    if (items.length === 0 && scan.findings) {
        (scan.findings || []).forEach(f => items.push({ resource: scan.bucket || '', rule_id: null, title: f, severity: scan.severity || 'MEDIUM', description: f, remediation: '', compliance: [] }));
    }
    return { total: items.length, by_severity: { critical: items.filter(v => v.severity === 'CRITICAL').length, high: items.filter(v => v.severity === 'HIGH').length, medium: items.filter(v => v.severity === 'MEDIUM').length, low: items.filter(v => v.severity === 'LOW').length }, items };
}

function _buildCompliance(scan) {
    try {
        const compMap = typeof scan.compliance_map === 'string' ? JSON.parse(scan.compliance_map) : (scan.compliance_map || {});
        const frameworks = {};
        for (const [name, data] of Object.entries(compMap)) {
            frameworks[name] = { ...data, compliance_percent: data.total_controls > 0 ? Math.round((data.passing / data.total_controls) * 100) : 100 };
        }
        return { frameworks };
    } catch { return { frameworks: {} }; }
}
