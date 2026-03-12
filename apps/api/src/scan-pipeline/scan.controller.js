const scannerAgent = require('./agents/scanner.agent');
const complianceReasoner = require('./agents/compliance-reasoner.agent');
const riskScorer = require('./agents/risk-scorer.agent');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = "CloudGuard_Scans"; // Ensure this table is created

exports.startScan = async (req, res) => {
    // If bucketName is provided, scan a specific bucket. Otherwise, scan all buckets.
    const { bucketName } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) {
        return res.status(403).json({ error: "Missing AWS Credentials. Please update your Settings." });
    }

    try {
        // 1. Scan (Dev A)
        // ScannerAgent will return an array of configs (even if it's just one)
        const rawConfigs = await scannerAgent.scanBuckets(credentials, bucketName);

        const scanResults = [];

        for (const rawConfig of rawConfigs) {
            // 2. Reason (Dev A)
            const analysis = await complianceReasoner.analyze(rawConfig, credentials);

            // 3. Score (Dev A)
            const score = riskScorer.calculate(analysis);

            // 4. Save to DB
            const scanId = uuidv4();
            const command = new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    scan_id: scanId,
                    user_email: req.user.email,
                    bucket: rawConfig.bucket, // Note: using bucket from rawConfig
                    status: score.severity === "CRITICAL" || score.severity === "HIGH" ? "AT_RISK" : "SECURE",
                    risk_score: score.score,
                    severity: score.severity,
                    compliance_status: analysis.compliance_status,
                    findings: analysis.violations,
                    explanation: analysis.reasoning,
                    remediation: analysis.remediation_suggestion,
                    raw_config: JSON.stringify(rawConfig),
                    created_at: new Date().toISOString()
                }
            });

            await docClient.send(command);
            scanResults.push({
                scan_id: scanId,
                result: {
                    bucket: rawConfig.bucket,
                    analysis,
                    score
                }
            });
        }

        // Response
        res.status(200).json({
            message: `Successfully scanned ${scanResults.length} bucket(s).`,
            scans: scanResults
        });

    } catch (error) {
        console.error("Scan Pipeline Failed:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getScans = async (req, res) => {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "user_email = :email",
            ExpressionAttributeValues: { ":email": req.user.email }
        });
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

        if (!response.Item || response.Item.user_email !== req.user.email) {
            return res.status(404).json({ error: "Scan not found" });
        }

        res.json(response.Item);
    } catch (error) {
        console.error("Get Scan By ID Failed:", error);
        res.status(500).json({ error: error.message });
    }
};
