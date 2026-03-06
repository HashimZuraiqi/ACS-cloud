const planner = require('./agents/remediation-planner.agent');
const executor = require('./agents/execution.agent');
const ec2Executor = require('./agents/ec2-execution.agent');
const scannerAgent = require('../scan-pipeline/agents/scanner.agent');
const ec2ScannerAgent = require('../scan-pipeline/agents/ec2-scanner.agent');
const complianceReasoner = require('../scan-pipeline/agents/compliance-reasoner.agent');
const ec2ComplianceReasoner = require('../scan-pipeline/agents/ec2-compliance-reasoner.agent');
const riskScorer = require('../scan-pipeline/agents/risk-scorer.agent');
const { docClient } = require('../config/db');
const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

exports.generatePlan = async (req, res) => {
    const { scanResult } = req.body;
    const plan = planner.createPlan(scanResult);
    res.json(plan);
};

/**
 * S3 Auto Fix: Look up scan → generate plan → execute → rescan → update DB → return new score
 */
exports.approveFix = async (req, res) => {
    console.log("[Remediation] S3 Fix Request:", JSON.stringify(req.body));
    const { scanId } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) {
        return res.status(403).json({ error: "Missing AWS Credentials. Please update your Settings." });
    }

    if (!scanId) {
        return res.status(400).json({ error: "scanId is required" });
    }

    try {
        // 1. Fetch the original scan
        const scanResult = await docClient.send(new GetCommand({
            TableName: "CloudGuard_Scans",
            Key: { scan_id: scanId }
        }));

        if (!scanResult.Item) {
            return res.status(404).json({ error: "Scan not found", receivedId: scanId });
        }

        const bucketName = scanResult.Item.bucket;
        console.log(`[Remediation] Fixing S3 bucket: ${bucketName}`);

        // 2. Generate remediation plan
        const plan = planner.createPlan(scanResult.Item);
        console.log(`[Remediation] Plan has ${plan.steps.length} steps`);

        // 3. Execute remediation in the correct region
        const regionalCredentials = { ...credentials, region: scanResult.Item.region };
        const executionResults = await executor.executePlan(plan, bucketName, regionalCredentials);
        console.log(`[Remediation] Execution complete:`, executionResults);

        // 4. Rescan the bucket
        console.log(`[Remediation] Rescanning ${bucketName}...`);
        const newRawConfig = await scannerAgent.scanBuckets(credentials, bucketName).then(res => res[0]);
        const newAnalysis = await complianceReasoner.analyze(newRawConfig, credentials);
        const newScore = riskScorer.calculate(newAnalysis);

        // 5. Save new scan to DB
        const newScanId = uuidv4();
        await docClient.send(new PutCommand({
            TableName: "CloudGuard_Scans",
            Item: {
                scan_id: newScanId,
                bucket: bucketName,
                status: newScore.severity === "CRITICAL" || newScore.severity === "HIGH" ? "AT_RISK" : "SECURE",
                risk_score: newScore.score,
                severity: newScore.severity,
                compliance_status: newAnalysis.compliance_status,
                findings: newAnalysis.violations,
                explanation: newAnalysis.reasoning,
                remediation: newAnalysis.remediation_suggestion,
                raw_config: JSON.stringify(newRawConfig),
                created_at: new Date().toISOString()
            }
        }));

        res.json({
            status: "COMPLETED",
            message: `Successfully applied ${executionResults.filter(r => r.status === "SUCCESS").length} fix(es) to ${bucketName}. Resource rescanned.`,
            details: executionResults,
            newRiskScore: newScore.score,
            newSeverity: newScore.severity,
            newScanId
        });

    } catch (err) {
        console.error("[Remediation] S3 Fix Failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * EC2 Auto Fix: Look up scan → generate plan → execute → rescan → update DB → return new score
 */
exports.approveEC2Fix = async (req, res) => {
    console.log("[Remediation] EC2 Fix Request:", JSON.stringify(req.body));
    const { scanId } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) {
        return res.status(403).json({ error: "Missing AWS Credentials. Please update your Settings." });
    }

    if (!scanId) {
        return res.status(400).json({ error: "scanId is required" });
    }

    try {
        // 1. Fetch the original EC2 scan
        const scanResult = await docClient.send(new GetCommand({
            TableName: "CloudGuard_EC2_Scans",
            Key: { scan_id: scanId }
        }));

        if (!scanResult.Item) {
            return res.status(404).json({ error: "EC2 scan not found", receivedId: scanId });
        }

        const instanceId = scanResult.Item.instance_id;
        console.log(`[Remediation] Fixing EC2 instance: ${instanceId}`);

        // 2. Generate EC2 remediation plan
        const plan = planner.createEC2Plan(scanResult.Item);
        console.log(`[Remediation] EC2 Plan has ${plan.steps.length} steps`);

        // 3. Execute remediation in the correct region
        const regionalCredentials = { ...credentials, region: scanResult.Item.region };
        const executionResults = await ec2Executor.executePlan(plan, instanceId, regionalCredentials);
        console.log(`[Remediation] EC2 Execution complete:`, executionResults);

        // 4. Rescan the instance
        console.log(`[Remediation] Rescanning ${instanceId}...`);
        const newRawConfig = await ec2ScannerAgent.scanInstance(instanceId, regionalCredentials);
        const newAnalysis = await ec2ComplianceReasoner.analyze(newRawConfig, credentials);
        const newScore = riskScorer.calculate(newAnalysis);

        // 5. Save new scan to DB
        const newScanId = uuidv4();
        await docClient.send(new PutCommand({
            TableName: "CloudGuard_EC2_Scans",
            Item: {
                scan_id: newScanId,
                instance_id: instanceId,
                status: newScore.severity === "CRITICAL" || newScore.severity === "HIGH" ? "AT_RISK" : "SECURE",
                risk_score: newScore.score,
                severity: newScore.severity,
                compliance_status: newAnalysis.compliance_status,
                findings: newAnalysis.violations,
                explanation: newAnalysis.reasoning,
                remediation: newAnalysis.remediation_suggestion,
                raw_config: JSON.stringify(newRawConfig),
                created_at: new Date().toISOString()
            }
        }));

        const succeeded = executionResults.filter(r => r.status === "SUCCESS").length;
        const failed = executionResults.filter(r => r.status === "FAILED").length;
        const recommendations = executionResults.filter(r => r.status === "RECOMMENDATION").length;

        let msg = `Applied ${succeeded} fix(es) to ${instanceId}.`;
        if (failed > 0) msg += ` ${failed} action(s) failed.`;
        if (recommendations > 0) msg += ` ${recommendations} manual recommendation(s).`;
        msg += ` Resource rescanned.`;

        res.json({
            status: failed > 0 && succeeded === 0 ? "PARTIAL" : "COMPLETED",
            message: msg,
            details: executionResults,
            newRiskScore: newScore.score,
            newSeverity: newScore.severity,
            newScanId
        });

    } catch (err) {
        console.error("[Remediation] EC2 Fix Failed:", err);
        res.status(500).json({ error: err.message });
    }
};
