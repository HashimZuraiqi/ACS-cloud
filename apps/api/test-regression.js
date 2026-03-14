const assert = require('assert');
const riskScorer = require('./src/scan-pipeline/agents/risk-scorer.agent');
const planner = require('./src/remediation-pipeline/agents/remediation-planner.agent');
const pdfGenerator = require('./src/reporting-pipeline/pdf-report-generator');

async function runTests() {
    console.log("Running Regression Tests for Remediation & Scoring...");

    // Test 1: Monotonicity of Risk Scorer
    const lowRiskFinding = { rule_id: 'S3-010', severity: 'LOW', remediationMode: 'AUTO_FIX' };
    const highRiskFinding = { rule_id: 'S3-001', severity: 'HIGH', remediationMode: 'AUTO_FIX' };

    const scoreWithHigh = riskScorer._computeBaseSeverity([highRiskFinding]);
    const scoreWithHighAndLow = riskScorer._computeBaseSeverity([highRiskFinding, lowRiskFinding]);

    console.log(`Score with High: ${scoreWithHigh}`);
    console.log(`Score with High + Low: ${scoreWithHighAndLow}`);
    
    // Additive logic means adding a low risk finding on top of a high risk finding must increase its score, not decrease it via avg.
    assert(scoreWithHighAndLow > scoreWithHigh, "Regression: Score decreased when adding a vulnerability");

    // Test 2: Planner Blocked Status
    // Assume we have a scanResult with a high score (80), and no auto-fix items remain.
    const mockScanResult = {
        bucket: "test-bucket",
        risk_score: 80
    };
    
    // Pass only a manual recommendation finding
    const mockFindings = [
        { rule_id: 'S3-007', severity: 'MEDIUM', title: 'Use SSE-KMS', reasoning: '...', remediationMode: 'MANUAL_RECOMMENDATION' }
    ];

    const plan = planner.createPlan(mockScanResult);
    // Well, wait. `createPlan` uses `scanResult.structured_findings`.
    mockScanResult.structured_findings = JSON.stringify(mockFindings);
    
    const realPlan = planner.createPlan(mockScanResult);
    
    console.log(`Plan Status when only manual fixes exist: ${realPlan.status}`);
    assert(realPlan.status === 'NO_ACTION_NEEDED' || realPlan.status === 'BLOCKED', "Regression: Plan should be blocked/no_action when only manual recommendations exist");

    // Test 3: PDF Generator doesn't crash on undefined compliance
    const mockReportData = {
        meta: {},
        executive_summary: { total_resources: 1, severity_distribution: {} },
        infrastructure_overview: { services: [{name: 'S3', count: 1}] },
        vulnerabilities: { items: [], by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
        compliance: {
            frameworks: {
                "SOC 2": { total_controls: null, passing: undefined, failing: null, compliance_percent: undefined }
            }
        },
        remediation_history: { actions: [] },
        security_timeline: [],
        score_summary: {
            average: 80,
            highest: { resource: 'test', risk_score: 80 },
            scores: []
        }
    };

    try {
        await pdfGenerator.generate(mockReportData);
        console.log("PDF generated successfully with undefined values");
        assert(true);
    } catch (e) {
        console.error("PDF generation crashed:", e);
        throw e;
    }

    console.log("All Regression Tests Passed ✅");
}

runTests().catch(err => {
    console.error("Test failed", err);
    process.exit(1);
});
