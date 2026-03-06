const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

class EC2ComplianceReasonerAgent {
    constructor() {
        this.bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
        this.modelId = "amazon.nova-micro-v1:0";
    }

    async analyze(instanceConfig) {
        console.log(`[EC2ComplianceReasoner] Analyzing config for: ${instanceConfig.instance_id}`);

        const prompt = `
      You are an expert Cloud Security Compliance Officer.
      Analyze the following AWS EC2 Instance Configuration for security risks, specifically focusing on SOC 2, CIS Benchmarks, and public exposure.

      Configuration:
      ${JSON.stringify(instanceConfig, null, 2)}

      Task:
      1. Determine if the instance is publicly exposed (Check Public IP, Security Groups for 0.0.0.0/0 ingress).
      2. Check if IMDSv2 is enforced (HttpTokens should be "required").
      3. Check if EBS volumes are encrypted.
      4. Check for overly permissive security group rules (e.g., SSH/RDP open to the world).
      5. Check if an IAM Instance Profile is attached.
      6. Identify violations of SOC 2 CC6.1 (Logical Access), CIS AWS Benchmark 5.x (EC2).
      7. Recommend specific remediation steps.

      Output ONLY valid JSON in this format:
      {
        "is_publicly_exposed": boolean,
        "risk_score": number (0-100),
        "compliance_status": "PASS" | "FAIL",
        "violations": ["string"],
        "reasoning": "string explanation",
        "remediation_suggestion": "string"
      }
    `;

        try {
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
                const response = await this.bedrock.send(command);
                const responseBody = JSON.parse(new TextDecoder().decode(response.body));

                let textContent = responseBody.output.message.content[0].text;
                if (textContent.includes("```json")) {
                    textContent = textContent.replace(/```json/g, "").replace(/```/g, "");
                }
                const result = JSON.parse(textContent);
                return result;
            } catch (bedrockError) {
                console.error(`[EC2ComplianceReasoner] Bedrock Call Failed (using mock as fallback): ${bedrockError.message}`);
                return this.mockAnalysis(instanceConfig);
            }

        } catch (error) {
            console.error(`[EC2ComplianceReasoner] Analysis Error: ${error.message}`);
            throw error;
        }
    }

    mockAnalysis(config) {
        let isPubliclyExposed = false;
        let riskScore = 10;
        let violations = [];
        let reasoning = "Instance settings appear secure.";
        let remediation = "No immediate action required.";

        // 1. Check Public IP Exposure
        if (config.public_ip) {
            isPubliclyExposed = true;
            riskScore = Math.max(riskScore, 50);
            violations.push("Medium: Instance has a public IP address assigned.");
            reasoning = "Instance is directly accessible from the internet via a public IP.";
        }

        // 2. Check Security Groups for dangerous open ports
        const dangerousPorts = [
            { port: 22, name: "SSH", severity: "Critical" },
            { port: 3389, name: "RDP", severity: "Critical" },
            { port: 0, name: "All Traffic", severity: "Critical" },   // port 0 = all ports when protocol is -1
            { port: 3306, name: "MySQL", severity: "High" },
            { port: 5432, name: "PostgreSQL", severity: "High" },
            { port: 1433, name: "MSSQL", severity: "High" },
            { port: 27017, name: "MongoDB", severity: "High" },
            { port: 6379, name: "Redis", severity: "High" }
        ];

        if (config.security_groups && Array.isArray(config.security_groups)) {
            for (const sg of config.security_groups) {
                for (const rule of (sg.inbound_rules || [])) {
                    const hasOpenCidr = (rule.ip_ranges || []).includes("0.0.0.0/0") ||
                        (rule.ipv6_ranges || []).includes("::/0");

                    if (hasOpenCidr) {
                        // Check if protocol is -1 (all traffic)
                        if (rule.protocol === "-1") {
                            isPubliclyExposed = true;
                            riskScore = 98;
                            violations.push(`Critical: Security Group ${sg.group_id} allows ALL inbound traffic from 0.0.0.0/0.`);
                            reasoning = "A security group allows unrestricted inbound access on all ports. This is a severe security risk.";
                            remediation = `Restrict inbound rules on Security Group ${sg.group_id} to specific IPs and ports.`;
                        } else {
                            // Check specific dangerous ports
                            for (const dp of dangerousPorts) {
                                if (dp.port === 0) continue; // Already handled by protocol -1 check
                                if (rule.from_port <= dp.port && rule.to_port >= dp.port) {
                                    isPubliclyExposed = true;
                                    const portRisk = dp.severity === "Critical" ? 90 : 75;
                                    riskScore = Math.max(riskScore, portRisk);
                                    violations.push(`${dp.severity}: Security Group ${sg.group_id} allows ${dp.name} (port ${dp.port}) from 0.0.0.0/0.`);
                                    reasoning = `Security group allows ${dp.name} access from the entire internet.`;
                                    remediation = `Restrict ${dp.name} (port ${dp.port}) access on Security Group ${sg.group_id} to trusted IPs only.`;
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Check EBS Volume Encryption
        if (config.ebs_volumes && Array.isArray(config.ebs_volumes)) {
            const unencryptedVolumes = config.ebs_volumes.filter(v => !v.encrypted);
            if (unencryptedVolumes.length > 0) {
                riskScore = Math.max(riskScore, 65);
                violations.push(`High: ${unencryptedVolumes.length} EBS volume(s) are not encrypted (${unencryptedVolumes.map(v => v.volume_id).join(", ")}).`);
                if (!reasoning.includes("EBS")) {
                    reasoning += " Unencrypted EBS volumes expose data at rest.";
                }
                remediation += " Enable EBS encryption for all attached volumes.";
            }
        }

        // 4. Check IMDSv2 Enforcement
        if (!config.imdsv2_required) {
            riskScore = Math.max(riskScore, 45);
            violations.push("Medium: IMDSv2 is not enforced (HttpTokens is not set to 'required').");
            if (!reasoning.includes("IMDS")) {
                reasoning += " IMDSv1 is vulnerable to SSRF attacks.";
            }
            remediation += " Set instance metadata to require IMDSv2 (HttpTokens: required).";
        }

        // 5. Check IAM Instance Profile
        if (!config.iam_profile) {
            riskScore = Math.max(riskScore, 35);
            violations.push("Medium: No IAM Instance Profile attached. Applications may use hardcoded credentials.");
            if (!reasoning.includes("IAM")) {
                reasoning += " Without an IAM Instance Profile, applications may rely on embedded credentials.";
            }
            remediation += " Attach an IAM Instance Profile with least-privilege permissions.";
        }

        // 6. Check Monitoring
        if (!config.monitoring_enabled) {
            riskScore = Math.max(riskScore, 20);
            violations.push("Low: Detailed monitoring is not enabled.");
            remediation += " Enable detailed CloudWatch monitoring for better observability.";
        }

        return {
            is_publicly_exposed: isPubliclyExposed,
            risk_score: riskScore,
            compliance_status: riskScore > 50 ? "FAIL" : "PASS",
            violations: violations.length > 0 ? violations : ["None"],
            reasoning: reasoning.trim(),
            remediation_suggestion: remediation.trim()
        };
    }
}

module.exports = new EC2ComplianceReasonerAgent();
