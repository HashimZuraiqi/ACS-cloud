/**
 * Advanced Security Controller
 * 
 * Orchestrates all advanced security analysis engines and returns
 * comprehensive security insights.
 */

const attackPathAnalyzer = require('../scan-pipeline/agents/attack-path-analyzer');
const privilegeEscalation = require('../scan-pipeline/agents/privilege-escalation');
const attackSimulation = require('../scan-pipeline/agents/attack-simulation');
const anomalyDetector = require('../scan-pipeline/agents/anomaly-detector');
const toxicCombinations = require('../scan-pipeline/agents/toxic-combinations');
const secretsDetector = require('../scan-pipeline/agents/secrets-detector');
const threatReasoning = require('../scan-pipeline/agents/threat-reasoning');
const { docClient } = require('../config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");

/**
 * Fetch all scans for the authenticated user from all tables.
 */
async function fetchAllScans(userEmail) {
    const tables = [
        { name: 'CloudGuard_Scans', key: 's3' },
        { name: 'CloudGuard_EC2_Scans', key: 'ec2' },
        { name: 'CloudGuard_IAM_Scans', key: 'iam' }
    ];

    const results = { s3: [], ec2: [], iam: [] };

    for (const table of tables) {
        try {
            const data = await docClient.send(new ScanCommand({
                TableName: table.name,
                FilterExpression: 'user_email = :email',
                ExpressionAttributeValues: { ':email': userEmail }
            }));
            results[table.key] = data.Items || [];
        } catch (err) {
            console.warn(`[AdvSecurity] Could not read ${table.name}: ${err.message}`);
        }
    }

    return results;
}

/**
 * GET /api/security/insights
 * Full advanced security analysis — attack paths, MITRE, anomalies, secrets, reasoning.
 */
exports.getSecurityInsights = async (req, res) => {
    try {
        const { s3, ec2, iam } = await fetchAllScans(req.user.email);

        // Run all engines in parallel
        const [attackPathResults, mitreResults, anomalyResults, toxicResults, secretResults, privEscResults] = await Promise.all([
            Promise.resolve(attackPathAnalyzer.analyze({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
            Promise.resolve(attackSimulation.simulate({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
            Promise.resolve(anomalyDetector.detect({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
            Promise.resolve(toxicCombinations.detect({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
            Promise.resolve(secretsDetector.scan({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
            Promise.resolve(privilegeEscalation.detect(iam))
        ]);

        // Feed everything into threat reasoning
        const avgScore = [...s3, ...ec2, ...iam].reduce((sum, s) => sum + (s.risk_score || 0), 0) / Math.max([...s3, ...ec2, ...iam].length, 1);

        const reasoning = threatReasoning.reason({
            attackPaths: attackPathResults.attack_paths,
            toxicCombinations: toxicResults.combinations,
            anomalies: anomalyResults.anomalies,
            secrets: secretResults.secrets,
            mitreResults: mitreResults,
            privilegeEscalations: privEscResults,
            overallRiskScore: Math.round(avgScore),
            resourceCounts: { s3: s3.length, ec2: ec2.length, iam: iam.length }
        });

        res.json({
            attack_paths: attackPathResults,
            mitre_simulation: mitreResults,
            anomalies: anomalyResults,
            toxic_combinations: toxicResults,
            secrets: secretResults,
            privilege_escalation: privEscResults,
            threat_reasoning: reasoning,
            meta: {
                generated_at: new Date().toISOString(),
                resources_analyzed: { s3: s3.length, ec2: ec2.length, iam: iam.length },
                engines_run: 7
            }
        });
    } catch (err) {
        console.error('[AdvSecurity] Insights failed:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/security/attack-paths
 * Attack paths only.
 */
exports.getAttackPaths = async (req, res) => {
    try {
        const { s3, ec2, iam } = await fetchAllScans(req.user.email);
        const result = attackPathAnalyzer.analyze({ s3Scans: s3, ec2Scans: ec2, iamScans: iam });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/security/mitre-coverage
 * MITRE ATT&CK simulation only.
 */
exports.getMitreCoverage = async (req, res) => {
    try {
        const { s3, ec2, iam } = await fetchAllScans(req.user.email);
        const result = attackSimulation.simulate({ s3Scans: s3, ec2Scans: ec2, iamScans: iam });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/security/anomalies
 * Anomaly detection only.
 */
exports.getAnomalies = async (req, res) => {
    try {
        const { s3, ec2, iam } = await fetchAllScans(req.user.email);
        const result = anomalyDetector.detect({ s3Scans: s3, ec2Scans: ec2, iamScans: iam });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/security/toxic-combos
 */
exports.getToxicCombos = async (req, res) => {
    try {
        const { s3, ec2, iam } = await fetchAllScans(req.user.email);
        const result = toxicCombinations.detect({ s3Scans: s3, ec2Scans: ec2, iamScans: iam });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/security/secrets
 */
exports.getSecrets = async (req, res) => {
    try {
        const { s3, ec2, iam } = await fetchAllScans(req.user.email);
        const result = secretsDetector.scan({ s3Scans: s3, ec2Scans: ec2, iamScans: iam, lambdaScans: [], cloudformationScans: [] });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/security/threat-analysis
 */
exports.getThreatAnalysis = async (req, res) => {
    try {
        const { s3, ec2, iam } = await fetchAllScans(req.user.email);
        
        // Run other analyzers as threatReasoning depends on them
        const [attackPaths, combinations, anomalies, secrets] = await Promise.all([
             Promise.resolve(attackPathAnalyzer.analyze({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
             Promise.resolve(toxicCombinations.detect({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
             Promise.resolve(anomalyDetector.detect({ s3Scans: s3, ec2Scans: ec2, iamScans: iam })),
             Promise.resolve(secretsDetector.scan({ s3Scans: s3, ec2Scans: ec2, iamScans: iam, lambdaScans: [], cloudformationScans: [] }))
        ]);
        
        const result = threatReasoning.analyze({
            attackPaths: attackPaths.attack_paths || [],
            toxicCombinations: combinations.combinations || [],
            anomalies: anomalies.anomalies || [],
            scanFindings: [...s3, ...ec2, ...iam]
        });
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
