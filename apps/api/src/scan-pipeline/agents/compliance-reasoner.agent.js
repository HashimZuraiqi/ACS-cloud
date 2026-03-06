const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

class ComplianceReasonerAgent {
    constructor() {
        this.modelId = "amazon.nova-micro-v1:0";
    }

    async analyze(bucketConfig, credentials) {
        if (!credentials) throw new Error("AWS Credentials are required");
        console.log(`[ComplianceReasoner] Analyzing config for: ${bucketConfig.bucket}`);

        const clientConfig = {
            region: credentials.region || "us-east-1",
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        };
        const bedrock = new BedrockRuntimeClient(clientConfig);

        const prompt = `
      You are an expert Cloud Security Compliance Officer.
      Analyze the following AWS S3 Bucket Configuration for security risks, specifically focusing on SOC 2 and public data exposure.

      Configuration:
      ${JSON.stringify(bucketConfig, null, 2)}

      Task:
      1. Determine if the bucket is publicly accessible (Check ACLs, Policies, PublicAccessBlock).
      2. Identify violations of SOC 2 CC6.6 (Logical Access).
      3. Recommend specific remediation steps.

      Output ONLY valid JSON in this format:
      {
        "is_public": boolean,
        "risk_score": number (0-100),
        "compliance_status": "PASS" | "FAIL",
        "violations": ["string"],
        "reasoning": "string explanation",
        "remediation_suggestion": "string"
      }
    `;

        try {
            // Prepare the payload for Amazon Nova (using Converse API structure or standard invoke)
            // Note: Adjusting payload structure for specific Nova model version
            const payload = {
                inferenceConfig: { max_new_tokens: 1000 },
                messages: [
                    {
                        role: "user",
                        content: [{ text: prompt }]
                    }
                ]
            };

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload),
            });

            // REAL BEDROCK CALL
            try {
                const response = await bedrock.send(command);
                const responseBody = JSON.parse(new TextDecoder().decode(response.body));

                // Parse Nova's output (handling potential markdown wrapping)
                let textContent = responseBody.output.message.content[0].text;
                // Strip markdown code blocks if present
                if (textContent.includes("```json")) {
                    textContent = textContent.replace(/```json/g, "").replace(/```/g, "");
                }
                const result = JSON.parse(textContent);
                return result;
            } catch (bedrockError) {
                console.error(`[ComplianceReasoner] Bedrock Call Failed (using mock as fallback): ${bedrockError.message}`);
                // Fallback to mock if AI fails (e.g. no credits yet) so app doesn't crash
                return this.mockAnalysis(bucketConfig);
            }

        } catch (error) {
            console.error(`[ComplianceReasoner] Analysis Error: ${error.message}`);
            throw error;
        }
    }

    mockAnalysis(config) {
        let isPublic = false;
        let riskScore = 15;
        let violations = [];
        let reasoning = "Bucket settings appear secure.";
        let remediation = "No immediate action required.";

        // 1. Check ACLs (Explicit Public Access)
        const publicGroups = [
            "http://acs.amazonaws.com/groups/global/AllUsers",
            "http://acs.amazonaws.com/groups/global/AuthenticatedUsers"
        ];

        if (config.acl && Array.isArray(config.acl)) {
            for (const grant of config.acl) {
                if (grant.Grantee && publicGroups.includes(grant.Grantee.URI)) {
                    isPublic = true;
                    riskScore = 95;
                    violations.push("Critical: Public ACL found (AllUsers or AuthenticatedUsers).");
                    reasoning = "The bucket ACL explicitly grants public access. This is a severe security risk.";
                    remediation = "Remove public grants from Bucket ACL immediately.";
                    break;
                }
            }
        }

        // 2. Check Public Access Block (PAB)
        // If PAB is missing or false, it's risky (though not necessarily public *yet*).
        // But for this demo, we treat "No PAB" as High Risk.
        if (!isPublic) {
            const pab = config.public_access_block || {};
            if (!pab.BlockPublicAcls || !pab.IgnorePublicAcls || !pab.BlockPublicPolicy || !pab.RestrictPublicBuckets) {
                riskScore = 65; // High Risk
                violations.push("High: Public Access Block is NOT enabled.");
                reasoning = "Public Access Block settings are disabled, leaving the bucket vulnerable to future public exposure.";
                remediation = "Enable 'Block Public Access' settings in S3 Console.";
            }
        }

        // 3. Check Policy (Simple Text Search for Wildcard Principal)
        if (!isPublic && config.policy) {
            const policyStr = JSON.stringify(config.policy);
            if (policyStr.includes('"Principal":"*"') || policyStr.includes('"Principal": "*"')) { // A bit naive but works for mock
                if (policyStr.includes('"Effect":"Allow"') || policyStr.includes('"Effect": "Allow"')) {
                    isPublic = true;
                    riskScore = 98; // Very Critical
                    violations.push("Critical: Bucket Policy ensures public access (Principal: *).");
                    reasoning = "The bucket policy allows public access via a wildcard principal (*).";
                    remediation = "Restrict Bucket Policy to specific IAM roles or users.";
                }
            }
        }

        return {
            is_public: isPublic,
            risk_score: riskScore,
            compliance_status: riskScore > 50 ? "FAIL" : "PASS",
            violations: violations.length > 0 ? violations : ["None"],
            reasoning: reasoning,
            remediation_suggestion: remediation
        };
    }
}

module.exports = new ComplianceReasonerAgent();
