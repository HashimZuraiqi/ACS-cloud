const planner = require('./agents/remediation-planner.agent');
const executor = require('./agents/execution.agent');

exports.generatePlan = async (req, res) => {
    // In a real flow, you'd fetch the scan result from DB first
    // For MVP, we pass the findings in body or mock it
    const { scanResult } = req.body;
    const plan = planner.createPlan(scanResult);
    res.json(plan);
};

const { docClient } = require('../config/db');
const { GetCommand } = require("@aws-sdk/lib-dynamodb");

exports.approveFix = async (req, res) => {
    // Debug: Log Incoming Request Body
    console.log("[Remediation] Incoming Request:", JSON.stringify(req.body));
    const { scanId } = req.body;

    if (!scanId) {
        console.error("[Remediation] Error: Missing scanId in body");
        return res.status(400).json({ error: "scanId is required" });
    }

    try {
        console.log(`[Remediation] Querying DynamoDB for scan_id: ${scanId}`);
        // 1. Fetch Scan Record
        const getCommand = new GetCommand({
            TableName: "CloudGuard_Scans",
            Key: { scan_id: scanId }
        });
        const scanResult = await docClient.send(getCommand);

        console.log(`[Remediation] Looking up scan_id: ${scanId}`);
        console.log(`[Remediation] Result:`, scanResult.Item ? "Found" : "Not Found");

        if (!scanResult.Item) {
            return res.status(404).json({ error: "Scan not found", receivedId: scanId });
        }

        const bucketName = scanResult.Item.bucket;

        // 2. Construct Plan (In MVP, we always apply Block Public Access if needed)
        // In future, parse `scanResult.Item.remediation` to determine precise steps
        const plan = {
            steps: [
                { action: "PUT_PUBLIC_ACCESS_BLOCK" }
            ]
        };

        // 3. Execute
        const executionResult = await executor.executePlan(plan, bucketName);

        // 4. Update Scan Status (Optional but good UX)
        // success...

        res.json({
            status: "COMPLETED",
            details: executionResult
        });
    } catch (err) {
        console.error("[Remediation] Failed:", err);
        res.status(500).json({ error: err.message });
    }
};
