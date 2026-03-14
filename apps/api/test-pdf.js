const fs = require('fs');
const pdfGenerator = require('./src/reporting-pipeline/pdf-report-generator');

async function run() {
    const mockReportData = {
        meta: {},
        executive_summary: { total_resources: 1, severity_distribution: {}, summary_text: "test" },
        infrastructure_overview: { services: [{name: 'S3', count: 1}] },
        vulnerabilities: { items: [], by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
        compliance: {
            frameworks: {
                "SOC 2": { total_controls: null, passing: undefined, failing: null, compliance_percent: undefined }
            }
        },
        remediation_history: { actions: [] },
        security_timeline: [],
        score_summary: { average: 80, highest: { resource: 'test', risk_score: 80 }, scores: [] },
        raw: { s3: [], ec2: [], iam: [], audit: [] }
    };

    try {
        await pdfGenerator.generate(mockReportData);
        fs.writeFileSync('pdf-result.txt', 'SUCCESS');
    } catch (e) {
        fs.writeFileSync('pdf-result.txt', e.stack || e.message);
    }
}
run();
