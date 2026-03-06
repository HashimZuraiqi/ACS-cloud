const iamScannerAgent = require('./agents/iam-scanner.agent');
const iamComplianceReasoner = require('./agents/iam-compliance-reasoner.agent');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = "CloudGuard_IAM_Scans";

exports.startIAMScan = async (req, res) => {
    const { username } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) {
        return res.status(403).json({ error: "Missing AWS Credentials. Please update your Settings." });
    }

    try {
        let results;

        if (username) {
            // Scan a single user
            const rawConfig = await iamScannerAgent.scanUser(username, credentials);
            const analysis = await iamComplianceReasoner.analyze(rawConfig);

            const scanId = uuidv4();
            const item = {
                scan_id: scanId,
                username: username,
                status: analysis.compliance_status === "COMPLIANT" ? "SECURE" : "AT_RISK",
                risk_score: analysis.score,
                severity: analysis.severity,
                compliance_status: analysis.compliance_status,
                findings: analysis.violations,
                explanation: analysis.reasoning,
                remediation: analysis.remediation_suggestion,
                raw_config: JSON.stringify(rawConfig),
                created_at: new Date().toISOString()
            };

            await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

            results = { scan_id: scanId, result: { username, analysis } };
        } else {
            // Scan all users
            const allConfigs = await iamScannerAgent.scanAllUsers(credentials);

            if (allConfigs.length === 0) {
                return res.status(200).json({ message: "No IAM users found.", results: [] });
            }

            const scanResults = [];
            for (const rawConfig of allConfigs) {
                if (rawConfig.error) {
                    scanResults.push({ username: rawConfig.username, error: rawConfig.error });
                    continue;
                }

                const analysis = await iamComplianceReasoner.analyze(rawConfig);

                const scanId = uuidv4();
                const item = {
                    scan_id: scanId,
                    username: rawConfig.username,
                    status: analysis.compliance_status === "COMPLIANT" ? "SECURE" : "AT_RISK",
                    risk_score: analysis.score,
                    severity: analysis.severity,
                    compliance_status: analysis.compliance_status,
                    findings: analysis.violations,
                    explanation: analysis.reasoning,
                    remediation: analysis.remediation_suggestion,
                    raw_config: JSON.stringify(rawConfig),
                    created_at: new Date().toISOString()
                };

                await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
                scanResults.push({ scan_id: scanId, result: { username: rawConfig.username, analysis } });
            }

            results = { total_scanned: scanResults.length, results: scanResults };
        }

        res.status(200).json(results);

    } catch (error) {
        console.error("IAM Scan Pipeline Failed:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getIAMScans = async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: TABLE_NAME });
        const response = await docClient.send(command);

        const scans = response.Items || [];
        const uniqueScansMap = new Map();

        scans.forEach(scan => {
            const existing = uniqueScansMap.get(scan.username);
            // Get the most recent scan per user
            if (!existing || new Date(scan.created_at) > new Date(existing.created_at)) {
                uniqueScansMap.set(scan.username, scan);
            }
        });

        const uniqueScans = Array.from(uniqueScansMap.values())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(uniqueScans);
    } catch (error) {
        console.error("[IAMScanController] Error fetching scans:", error);
        // Important: Handle empty tables smoothly since the "CloudGuard_IAM_Scans" table may not exist immediately,
        // or we simply return []
        if (error.name === 'ResourceNotFoundException') {
            return res.json([]);
        }
        res.status(500).json({ error: "Failed to fetch IAM scan history" });
    }
};

exports.getIAMScanById = async (req, res) => {
    const { id } = req.params;
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { scan_id: id }
        });
        const response = await docClient.send(command);

        if (!response.Item) {
            return res.status(404).json({ error: "IAM scan not found" });
        }

        res.json(response.Item);
    } catch (error) {
        console.error("Get IAM Scan By ID Failed:", error);
        res.status(500).json({ error: error.message });
    }
};
