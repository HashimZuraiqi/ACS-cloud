const ec2ScannerAgent = require('./agents/ec2-scanner.agent');
const ec2ComplianceReasoner = require('./agents/ec2-compliance-reasoner.agent');
const riskScorer = require('./agents/risk-scorer.agent');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = "CloudGuard_EC2_Scans";

exports.startEC2Scan = async (req, res) => {
    const { instanceId } = req.body;
    const credentials = req.user?.awsCredentials;

    if (!credentials) {
        return res.status(403).json({ error: "Missing AWS Credentials. Please update your Settings." });
    }

    try {
        let results;

        if (instanceId) {
            // Scan a single instance
            const rawConfig = await ec2ScannerAgent.scanInstance(instanceId, credentials);
            const analysis = await ec2ComplianceReasoner.analyze(rawConfig, credentials);
            const score = riskScorer.calculateWeighted(
                analysis.findings || [],
                rawConfig,
                analysis
            );

            const scanId = uuidv4();
            const item = {
                scan_id: scanId,
                user_email: req.user.email,
                instance_id: instanceId,
                status: score.severity === "CRITICAL" || score.severity === "HIGH" ? "AT_RISK" : "SECURE",
                risk_score: score.score,
                severity: score.severity,
                compliance_status: analysis.compliance_status,
                findings: analysis.violations,
                explanation: analysis.reasoning,
                remediation: analysis.remediation_suggestion,
                raw_config: JSON.stringify(rawConfig),
                created_at: new Date().toISOString(),

                // ── Enhanced fields ──────────────────────────────────
                evidence_chains: JSON.stringify(analysis.evidence_chains || []),
                compliance_map: JSON.stringify(analysis.compliance_map || {}),
                score_breakdown: JSON.stringify(score.factors || {}),
                score_category: score.category || 'Configuration',
                rule_summary: JSON.stringify(analysis.rule_summary || {}),
                structured_findings: JSON.stringify(analysis.findings || []),
                ai_verified: analysis.ai_available || false,
            };

            await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

            results = { scan_id: scanId, result: { instance_id: instanceId, analysis, score } };
        } else {
            // Scan all running instances
            const allConfigs = await ec2ScannerAgent.scanAllInstances(credentials);

            if (allConfigs.length === 0) {
                return res.status(200).json({ message: "No running EC2 instances found.", results: [] });
            }

            const scanResults = [];
            for (const rawConfig of allConfigs) {
                if (rawConfig.error) {
                    scanResults.push({ instance_id: rawConfig.instance_id, error: rawConfig.error });
                    continue;
                }

                const analysis = await ec2ComplianceReasoner.analyze(rawConfig, credentials);
                const score = riskScorer.calculateWeighted(
                    analysis.findings || [],
                    rawConfig,
                    analysis
                );

                const scanId = uuidv4();
                const item = {
                    scan_id: scanId,
                    user_email: req.user.email,
                    instance_id: rawConfig.instance_id,
                    status: score.severity === "CRITICAL" || score.severity === "HIGH" ? "AT_RISK" : "SECURE",
                    risk_score: score.score,
                    severity: score.severity,
                    compliance_status: analysis.compliance_status,
                    findings: analysis.violations,
                    explanation: analysis.reasoning,
                    remediation: analysis.remediation_suggestion,
                    raw_config: JSON.stringify(rawConfig),
                    created_at: new Date().toISOString(),

                    // ── Enhanced fields ──────────────────────────────
                    evidence_chains: JSON.stringify(analysis.evidence_chains || []),
                    compliance_map: JSON.stringify(analysis.compliance_map || {}),
                    score_breakdown: JSON.stringify(score.factors || {}),
                    score_category: score.category || 'Configuration',
                    rule_summary: JSON.stringify(analysis.rule_summary || {}),
                    structured_findings: JSON.stringify(analysis.findings || []),
                    ai_verified: analysis.ai_available || false,
                };

                await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
                scanResults.push({ scan_id: scanId, result: { instance_id: rawConfig.instance_id, analysis, score } });
            }

            results = { total_scanned: scanResults.length, results: scanResults };
        }

        res.status(200).json(results);

    } catch (error) {
        console.error("EC2 Scan Pipeline Failed:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getEC2Scans = async (req, res) => {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "user_email = :email",
            ExpressionAttributeValues: { ":email": req.user.email }
        });
        const response = await docClient.send(command);

        const scans = response.Items || [];
        const uniqueScansMap = new Map();

        scans.forEach(scan => {
            const existing = uniqueScansMap.get(scan.instance_id);
            if (!existing || new Date(scan.created_at) > new Date(existing.created_at)) {
                uniqueScansMap.set(scan.instance_id, scan);
            }
        });

        const uniqueScans = Array.from(uniqueScansMap.values())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(uniqueScans);
    } catch (error) {
        console.error("[EC2ScanController] Error fetching scans:", error);
        res.status(500).json({ error: "Failed to fetch EC2 scan history" });
    }
};

exports.getEC2ScanById = async (req, res) => {
    const { id } = req.params;
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { scan_id: id }
        });
        const response = await docClient.send(command);

        if (!response.Item || response.Item.user_email !== req.user.email) {
            return res.status(404).json({ error: "EC2 scan not found" });
        }

        res.json(response.Item);
    } catch (error) {
        console.error("Get EC2 Scan By ID Failed:", error);
        res.status(500).json({ error: error.message });
    }
};
