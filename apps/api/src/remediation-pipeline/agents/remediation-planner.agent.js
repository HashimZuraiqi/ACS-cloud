class RemediationPlannerAgent {

    /**
     * Generate an S3 remediation plan based on scan findings.
     */
    createPlan(scanResult) {
        console.log(`[RemediationPlanner] Generating S3 plan for: ${scanResult.bucket}`);

        const steps = [];
        const findings = scanResult.findings || [];
        const findingsStr = JSON.stringify(findings).toLowerCase();

        if (findingsStr.includes("public access") || findingsStr.includes("public acl") || findingsStr.includes("alluser")) {
            steps.push({ action: "PUT_PUBLIC_ACCESS_BLOCK", description: "Enable Block Public Access", risk_of_change: "Low" });
        }

        if (findingsStr.includes("acl") || findingsStr.includes("alluser") || findingsStr.includes("authenticateduser")) {
            steps.push({ action: "REMOVE_PUBLIC_ACLS", description: "Set bucket ACL to private", risk_of_change: "Low" });
        }

        if (findingsStr.includes("policy") || findingsStr.includes("principal") || findingsStr.includes("wildcard")) {
            steps.push({ action: "SANITIZE_BUCKET_POLICY", description: "Remove wildcard principal Allow statements", risk_of_change: "Medium" });
        }

        if (findingsStr.includes("encrypt") || findingsStr.includes("not_configured") || findingsStr.includes("sse")) {
            steps.push({ action: "ENABLE_ENCRYPTION", description: "Enable SSE-S3 (AES256) encryption", risk_of_change: "None" });
        }

        steps.push({ action: "ENABLE_VERSIONING", description: "Enable bucket versioning", risk_of_change: "None" });
        steps.push({ action: "ENABLE_LOGGING", description: "Enable S3 access logging", risk_of_change: "None" });

        return { plan_id: `plan_s3_${Date.now()}`, service: "s3", resource: scanResult.bucket, status: "PENDING_APPROVAL", steps };
    }

    /**
     * Generate an EC2 remediation plan.
     * Uses BOTH the findings strings AND the raw_config to determine what needs fixing.
     */
    createEC2Plan(scanResult) {
        const instanceId = scanResult.instance_id;
        console.log(`[RemediationPlanner] Generating EC2 plan for: ${instanceId}`);

        const steps = [];
        const findings = scanResult.findings || [];
        const findingsStr = JSON.stringify(findings).toLowerCase();

        // Parse raw_config to check actual state (more reliable than string matching)
        let rawConfig = {};
        try {
            rawConfig = typeof scanResult.raw_config === 'string'
                ? JSON.parse(scanResult.raw_config)
                : (scanResult.raw_config || {});
        } catch (e) {
            console.warn(`[RemediationPlanner] Could not parse raw_config: ${e.message}`);
        }

        // 1. Check for SSH open to world — inspect raw security group rules directly
        const hasOpenSSH = this._hasOpenPort(rawConfig, 22);
        if (hasOpenSSH || findingsStr.includes("ssh") || findingsStr.includes("port 22") || findingsStr.includes("0.0.0.0/0")) {
            steps.push({
                action: "RESTRICT_SSH",
                description: "Revoke SSH (port 22) access from 0.0.0.0/0. Add your trusted IP manually after.",
                risk_of_change: "High — will block SSH from all IPs."
            });
            console.log(`[RemediationPlanner] ➤ RESTRICT_SSH (hasOpenSSH=${hasOpenSSH})`);
        }

        // 2. Check for other dangerous open ports
        const hasOpenDangerous = this._hasOpenDangerousPorts(rawConfig);
        if (hasOpenDangerous || findingsStr.includes("all inbound") || findingsStr.includes("rdp") || findingsStr.includes("3389")) {
            steps.push({
                action: "RESTRICT_SECURITY_GROUPS",
                description: "Revoke dangerous public inbound rules (RDP, databases, all-traffic)",
                risk_of_change: "High — may break network access."
            });
            console.log(`[RemediationPlanner] ➤ RESTRICT_SECURITY_GROUPS (hasOpenDangerous=${hasOpenDangerous})`);
        }

        // 3. IMDSv2 — check raw config directly
        const imdsv2Required = rawConfig.imdsv2_required === true ||
            rawConfig.metadata_options?.HttpTokens === "required";
        if (!imdsv2Required || findingsStr.includes("imds") || findingsStr.includes("metadata")) {
            if (!imdsv2Required) {
                steps.push({
                    action: "ENFORCE_IMDSV2",
                    description: "Enforce IMDSv2 (set HttpTokens to 'required')",
                    risk_of_change: "Low"
                });
                console.log(`[RemediationPlanner] ➤ ENFORCE_IMDSV2`);
            }
        }

        // 4. Monitoring — check raw config directly
        const monitoringEnabled = rawConfig.monitoring_enabled === true;
        if (!monitoringEnabled || findingsStr.includes("monitoring") || findingsStr.includes("cloudwatch")) {
            if (!monitoringEnabled) {
                steps.push({
                    action: "ENABLE_MONITORING",
                    description: "Enable detailed CloudWatch monitoring",
                    risk_of_change: "None"
                });
                console.log(`[RemediationPlanner] ➤ ENABLE_MONITORING`);
            }
        }

        // 5. EBS Encryption
        const hasUnencrypted = (rawConfig.ebs_volumes || []).some(v => !v.encrypted);
        if (hasUnencrypted || findingsStr.includes("ebs") || findingsStr.includes("encrypt") || findingsStr.includes("volume")) {
            if (hasUnencrypted) {
                steps.push({
                    action: "ENCRYPT_EBS_VOLUMES",
                    description: "Encrypt unencrypted EBS volumes (manual — requires snapshot+copy)",
                    risk_of_change: "Manual action required."
                });
                console.log(`[RemediationPlanner] ➤ ENCRYPT_EBS_VOLUMES`);
            }
        }

        console.log(`[RemediationPlanner] EC2 plan: ${steps.length} step(s) for ${instanceId}`);

        return { plan_id: `plan_ec2_${Date.now()}`, service: "ec2", resource: instanceId, status: "PENDING_APPROVAL", steps };
    }

    // ─── Helpers to inspect raw security group rules ─────────────────

    _hasOpenPort(rawConfig, targetPort) {
        if (!rawConfig.security_groups || !Array.isArray(rawConfig.security_groups)) return false;

        for (const sg of rawConfig.security_groups) {
            for (const rule of (sg.inbound_rules || [])) {
                const hasOpenCidr = (rule.ip_ranges || []).includes("0.0.0.0/0") ||
                    (rule.ipv6_ranges || []).includes("::/0");
                if (!hasOpenCidr) continue;

                // All traffic
                if (rule.protocol === "-1") return true;

                // Specific port range
                if (rule.from_port !== undefined && rule.to_port !== undefined &&
                    rule.from_port <= targetPort && rule.to_port >= targetPort) {
                    return true;
                }
            }
        }
        return false;
    }

    _hasOpenDangerousPorts(rawConfig) {
        const dangerousPorts = [3389, 3306, 5432, 1433, 27017, 6379];
        if (!rawConfig.security_groups || !Array.isArray(rawConfig.security_groups)) return false;

        for (const sg of rawConfig.security_groups) {
            for (const rule of (sg.inbound_rules || [])) {
                const hasOpenCidr = (rule.ip_ranges || []).includes("0.0.0.0/0") ||
                    (rule.ipv6_ranges || []).includes("::/0");
                if (!hasOpenCidr) continue;

                if (rule.protocol === "-1") return true;

                for (const port of dangerousPorts) {
                    if (rule.from_port !== undefined && rule.to_port !== undefined &&
                        rule.from_port <= port && rule.to_port >= port) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}

module.exports = new RemediationPlannerAgent();
