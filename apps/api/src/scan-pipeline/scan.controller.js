const scannerAgent = require('./agents/scanner.agent');
const complianceReasoner = require('./agents/compliance-reasoner.agent');
const riskScorer = require('./agents/risk-scorer.agent');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = "CloudGuard_Scans"; // Ensure this table is created

exports.startScan = async (req, res) => {
    const { bucketName } = req.body;

    if (!bucketName) {
        return res.status(400).json({ error: "Bucket name is required" });
    }

    try {
        // 1. Scan (Dev A)
        const rawConfig = await scannerAgent.scanBucket(bucketName);

        // 2. Reason (Dev A)
        const analysis = await complianceReasoner.analyze(rawConfig);

        // 3. Score (Dev A)
        const score = riskScorer.calculate(analysis);

        // 4. Save to DB
        const scanId = uuidv4();
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                scan_id: scanId,
                bucket: bucketName,
                status: score.severity === "CRITICAL" || score.severity === "HIGH" ? "AT_RISK" : "SECURE",
                risk_score: score.score,
                severity: score.severity,
                compliance_status: analysis.compliance_status,
                findings: analysis.violations,
                explanation: analysis.reasoning,
                remediation: analysis.remediation_suggestion, // Save the fix suggestion
                raw_config: JSON.stringify(rawConfig), // Store for audit
                created_at: new Date().toISOString()
            }
        });

        // Save to DB
        await docClient.send(command);

        // Response
        res.status(200).json({
            scan_id: scanId,
            result: {
                bucket: bucketName,
                analysis,
                score
            }
        });

    } catch (error) {
        console.error("Scan Pipeline Failed:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getScans = async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: TABLE_NAME });
        const response = await docClient.send(command);

        // Deduplicate: Group by bucket, keep only the LATEST scan
        const scans = response.Items || [];
        const uniqueScansMap = new Map();

        scans.forEach(scan => {
            const existing = uniqueScansMap.get(scan.bucket);
            // If new or newer than existing, update map
            if (!existing || new Date(scan.created_at) > new Date(existing.created_at)) {
                uniqueScansMap.set(scan.bucket, scan);
            }
        });

        // Convert map back to array & sort by date (newest first)
        const uniqueScans = Array.from(uniqueScansMap.values())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(uniqueScans);
    } catch (error) {
        console.error("[ScanController] Error fetching scans:", error);
        res.status(500).json({ error: "Failed to fetch scan history" });
    }
};

exports.getScanById = async (req, res) => {
    const { id } = req.params;
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { scan_id: id }
        });
        const response = await docClient.send(command);

        if (!response.Item) {
            return res.status(404).json({ error: "Scan not found" });
        }

        res.json(response.Item);
    } catch (error) {
        console.error("Get Scan By ID Failed:", error);
        res.status(500).json({ error: error.message });
    }
};
