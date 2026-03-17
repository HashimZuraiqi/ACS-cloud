const planner = require('./agents/remediation-planner.agent');
const executor = require('./agents/execution.agent');
const ec2Executor = require('./agents/ec2-execution.agent');
const stateSnapshot = require('./agents/state-snapshot');
const rollbackAgent = require('./agents/rollback.agent');
const auditLogger = require('./agents/remediation-audit-logger');
const scannerAgent = require('../scan-pipeline/agents/scanner.agent');
const ec2ScannerAgent = require('../scan-pipeline/agents/ec2-scanner.agent');
const complianceReasoner = require('../scan-pipeline/agents/compliance-reasoner.agent');
const ec2ComplianceReasoner = require('../scan-pipeline/agents/ec2-compliance-reasoner.agent');
const riskScorer = require('../scan-pipeline/agents/risk-scorer.agent');
const { docClient } = require('../config/db');
const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

/**
 * Smart Plan: Generate a remediation plan with decision classification.
 * Returns AUTO_FIX / SUGGEST_FIX / INTENTIONAL_SKIP per step.
 */
exports.generateSmartPlan = async (req, res) => {
    const { scanId, service } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) return res.status(403).json({ error: "Missing AWS Credentials." });
    if (!scanId) return res.status(400).json({ error: "scanId is required" });

    try {
        const tableName = service === 'ec2' ? "CloudGuard_EC2_Scans" : "CloudGuard_Scans";
        const scanResult = await docClient.send(new GetCommand({ TableName: tableName, Key: { scan_id: scanId } }));

        if (!scanResult.Item) return res.status(404).json({ error: "Scan not found" });

        const plan = service === 'ec2'
            ? planner.createEC2Plan(scanResult.Item)
            : planner.createPlan(scanResult.Item);

        res.json(plan);
    } catch (err) {
        console.error("[Remediation] Smart plan failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Legacy plan generation (backward compat).
 */
exports.generatePlan = async (req, res) => {
    const { scanResult } = req.body;
    const plan = planner.createPlan(scanResult);
    res.json(plan);
};

/**
 * S3 Auto Fix with snapshot, audit logging, and smart decision filtering.
 */
exports.approveFix = async (req, res) => {
    console.log("[Remediation] S3 Fix Request:", JSON.stringify(req.body));
    const { scanId, approvedSteps } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) return res.status(403).json({ error: "Missing AWS Credentials." });
    if (!scanId) return res.status(400).json({ error: "scanId is required" });

    try {
        // 1. Fetch the original scan
        const scanResult = await docClient.send(new GetCommand({
            TableName: "CloudGuard_Scans", Key: { scan_id: scanId }
        }));
        if (!scanResult.Item) return res.status(404).json({ error: "Scan not found" });

        const bucketName = scanResult.Item.bucket;
        console.log(`[Remediation] Fixing S3 bucket: ${bucketName}`);

        // 2. Generate smart plan
        const plan = planner.createPlan(scanResult.Item);

        if (plan.status === 'NO_ACTION_NEEDED') {
            return res.status(400).json({ error: "No actionable findings to fix.", plan });
        }

        if (plan.status === 'ASSISTED_ONLY') {
            return res.json({
                status: 'ASSISTED_ONLY',
                message: 'Remaining items require manual review. Generate fix scripts below.',
                plan
            });
        }

        // 3. Filter steps: only execute AUTO_FIX and explicitly approved SUGGEST_FIX
        const approvedSet = new Set(approvedSteps || []);
        const stepsToExecute = plan.steps.filter(step =>
            step.decision === 'AUTO_FIX' || approvedSet.has(step.action)
        );
        const skippedSteps = plan.steps.filter(step =>
            step.decision === 'INTENTIONAL_SKIP' || (!approvedSet.has(step.action) && step.decision === 'SUGGEST_FIX')
        );

        // 4. Capture state snapshot before applying fixes
        const snapshot = await stateSnapshot.capture(bucketName, 'S3', credentials, plan.plan_id);

        // 5. Execute only approved/auto steps
        const executionPlan = { ...plan, steps: stepsToExecute };
        const regionalCredentials = { ...credentials, region: scanResult.Item.region };
        const executionResults = await executor.executePlan(executionPlan, bucketName, regionalCredentials);

        // 6. Audit log all actions
        await auditLogger.logBatch(
            req.user.email, bucketName, 'S3', plan.plan_id, snapshot.snapshot_id,
            [
                ...executionResults.map(r => ({ ...r, decision: stepsToExecute.find(s => s.action === r.action)?.decision })),
                ...skippedSteps.map(s => ({ action: s.action, status: 'SKIPPED', decision: s.decision, reasoning: s.reasoning }))
            ]
        );

        // 7. Rescan the bucket
        const newRawConfig = await scannerAgent.scanBuckets(credentials, bucketName).then(r => r[0]);
        const newAnalysis = await complianceReasoner.analyze(newRawConfig, credentials);
        const newScore = riskScorer.calculateWeighted(newAnalysis.findings || [], newRawConfig, newAnalysis);

        // 8. Save new scan
        const newScanId = uuidv4();
        await docClient.send(new PutCommand({
            TableName: "CloudGuard_Scans",
            Item: {
                scan_id: newScanId, user_email: req.user.email, bucket: bucketName,
                status: newScore.severity === "CRITICAL" || newScore.severity === "HIGH" ? "AT_RISK" : "SECURE",
                risk_score: newScore.score, severity: newScore.severity,
                compliance_status: newAnalysis.compliance_status,
                findings: newAnalysis.violations, explanation: newAnalysis.reasoning,
                remediation: newAnalysis.remediation_suggestion,
                raw_config: JSON.stringify(newRawConfig), created_at: new Date().toISOString(),
                evidence_chains: JSON.stringify(newAnalysis.evidence_chains || []),
                compliance_map: JSON.stringify(newAnalysis.compliance_map || {}),
                score_breakdown: JSON.stringify(newScore.factors || {}),
                structured_findings: JSON.stringify(newAnalysis.findings || []),
            }
        }));

        const succeeded = executionResults.filter(r => r.status === "SUCCESS").length;
        res.json({
            status: "COMPLETED",
            message: `Applied ${succeeded} fix(es) to ${bucketName}. ${skippedSteps.length} step(s) skipped.`,
            details: executionResults,
            skipped: skippedSteps.map(s => ({ action: s.action, decision: s.decision, reasoning: s.reasoning })),
            snapshot_id: snapshot.snapshot_id,
            newRiskScore: newScore.score, newSeverity: newScore.severity, newScanId
        });
    } catch (err) {
        console.error("[Remediation] S3 Fix Failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * EC2 Auto Fix with snapshot, audit logging, and smart decision filtering.
 */
exports.approveEC2Fix = async (req, res) => {
    console.log("[Remediation] EC2 Fix Request:", JSON.stringify(req.body));
    const { scanId, approvedSteps } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) return res.status(403).json({ error: "Missing AWS Credentials." });
    if (!scanId) return res.status(400).json({ error: "scanId is required" });

    try {
        const scanResult = await docClient.send(new GetCommand({
            TableName: "CloudGuard_EC2_Scans", Key: { scan_id: scanId }
        }));
        if (!scanResult.Item) return res.status(404).json({ error: "EC2 scan not found" });

        const instanceId = scanResult.Item.instance_id;
        const plan = planner.createEC2Plan(scanResult.Item);

        if (plan.status === 'NO_ACTION_NEEDED') {
            return res.status(400).json({ error: "No actionable findings to fix.", plan });
        }

        if (plan.status === 'ASSISTED_ONLY') {
            return res.json({
                status: 'ASSISTED_ONLY',
                message: 'Remaining items require manual review. Generate fix scripts below.',
                plan
            });
        }

        const approvedSet = new Set(approvedSteps || []);
        const stepsToExecute = plan.steps.filter(s =>
            s.decision === 'AUTO_FIX' || approvedSet.has(s.action)
        );
        const skippedSteps = plan.steps.filter(s =>
            s.decision === 'INTENTIONAL_SKIP' || (!approvedSet.has(s.action) && s.decision === 'SUGGEST_FIX')
        );

        const snapshot = await stateSnapshot.capture(instanceId, 'EC2', credentials, plan.plan_id);

        const executionPlan = { ...plan, steps: stepsToExecute };
        const regionalCredentials = { ...credentials, region: scanResult.Item.region };
        const executionResults = await ec2Executor.executePlan(executionPlan, instanceId, regionalCredentials);

        await auditLogger.logBatch(
            req.user.email, instanceId, 'EC2', plan.plan_id, snapshot.snapshot_id,
            [
                ...executionResults.map(r => ({ ...r, decision: stepsToExecute.find(s => s.action === r.action)?.decision })),
                ...skippedSteps.map(s => ({ action: s.action, status: 'SKIPPED', decision: s.decision, reasoning: s.reasoning }))
            ]
        );

        const newRawConfig = await ec2ScannerAgent.scanInstance(instanceId, regionalCredentials);
        const newAnalysis = await ec2ComplianceReasoner.analyze(newRawConfig, credentials);
        const newScore = riskScorer.calculateWeighted(newAnalysis.findings || [], newRawConfig, newAnalysis);

        const newScanId = uuidv4();
        await docClient.send(new PutCommand({
            TableName: "CloudGuard_EC2_Scans",
            Item: {
                scan_id: newScanId, user_email: req.user.email, instance_id: instanceId,
                status: newScore.severity === "CRITICAL" || newScore.severity === "HIGH" ? "AT_RISK" : "SECURE",
                risk_score: newScore.score, severity: newScore.severity,
                compliance_status: newAnalysis.compliance_status,
                findings: newAnalysis.violations, explanation: newAnalysis.reasoning,
                remediation: newAnalysis.remediation_suggestion,
                raw_config: JSON.stringify(newRawConfig), created_at: new Date().toISOString(),
                evidence_chains: JSON.stringify(newAnalysis.evidence_chains || []),
                compliance_map: JSON.stringify(newAnalysis.compliance_map || {}),
                structured_findings: JSON.stringify(newAnalysis.findings || []),
            }
        }));

        const succeeded = executionResults.filter(r => r.status === "SUCCESS").length;
        const failed = executionResults.filter(r => r.status === "FAILED").length;
        res.json({
            status: failed > 0 && succeeded === 0 ? "PARTIAL" : "COMPLETED",
            message: `Applied ${succeeded} fix(es) to ${instanceId}. ${skippedSteps.length} skipped.`,
            details: executionResults,
            skipped: skippedSteps.map(s => ({ action: s.action, decision: s.decision, reasoning: s.reasoning })),
            snapshot_id: snapshot.snapshot_id,
            newRiskScore: newScore.score, newSeverity: newScore.severity, newScanId
        });
    } catch (err) {
        console.error("[Remediation] EC2 Fix Failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Rollback a remediation using a snapshot.
 */
exports.rollback = async (req, res) => {
    const { snapshotId } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) return res.status(403).json({ error: "Missing AWS Credentials." });
    if (!snapshotId) return res.status(400).json({ error: "snapshotId is required" });

    try {
        const result = await rollbackAgent.rollback(snapshotId, credentials);

        await auditLogger.log({
            user_email: req.user.email,
            resource_id: result.resource_id,
            resource_type: result.resource_type,
            action: 'ROLLBACK',
            decision: 'MANUAL_ROLLBACK',
            status: result.status,
            plan_id: null,
            snapshot_id: snapshotId,
            details: result.details,
            reasoning: 'User-initiated rollback'
        });

        res.json(result);
    } catch (err) {
        console.error("[Remediation] Rollback Failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get remediation audit log.
 */
exports.getAuditLog = async (req, res) => {
    try {
        const { resourceId } = req.query;
        const log = resourceId
            ? await auditLogger.getResourceLog(resourceId, req.user.email)
            : await auditLogger.getUserLog(req.user.email);
        res.json(log);
    } catch (err) {
        console.error("[Remediation] Audit log fetch failed:", err);
        res.status(500).json({ error: err.message });
    }
};
