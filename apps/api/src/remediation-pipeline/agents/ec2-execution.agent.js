const {
    EC2Client,
    RevokeSecurityGroupIngressCommand,
    ModifyInstanceMetadataOptionsCommand,
    MonitorInstancesCommand,
    DescribeInstancesCommand,
    DescribeSecurityGroupsCommand
} = require("@aws-sdk/client-ec2");

class EC2ExecutionAgent {
    constructor() {
        this.defaultRegion = process.env.AWS_REGION || "us-east-1";
        this.ec2 = new EC2Client({ region: this.defaultRegion });
    }

    async executePlan(plan, instanceId) {
        console.log(`[EC2Exec] ── Executing ${plan.steps.length} step(s) for ${instanceId} (region: ${this.defaultRegion})`);

        const results = [];
        for (const step of plan.steps) {
            try {
                const result = await this._executeStep(step, instanceId);
                results.push(result);
                console.log(`[EC2Exec] ${result.status === 'SUCCESS' ? '✓' : result.status === 'FAILED' ? '✗' : '⚠'} ${step.action}: ${result.message}`);
            } catch (error) {
                console.error(`[EC2Exec] ✗ ${step.action} EXCEPTION: ${error.message}`);
                results.push({ action: step.action, status: "FAILED", message: error.message });
            }
        }

        return results;
    }

    async _executeStep(step, instanceId) {
        switch (step.action) {
            case "ENFORCE_IMDSV2":
                return await this._enforceImdsv2(instanceId);
            case "ENABLE_MONITORING":
                return await this._enableMonitoring(instanceId);
            case "RESTRICT_SSH":
                return await this._restrictSSH(instanceId);
            case "RESTRICT_SECURITY_GROUPS":
                return await this._restrictSecurityGroups(instanceId);
            case "ENCRYPT_EBS_VOLUMES":
                return {
                    action: "ENCRYPT_EBS_VOLUMES",
                    status: "RECOMMENDATION",
                    message: "EBS encryption requires creating snapshots and new encrypted volumes. This should be done manually to avoid data loss."
                };
            default:
                return { action: step.action, status: "SKIPPED", message: `Unknown action: ${step.action}` };
        }
    }

    // ─── IMDSV2 ──────────────────────────────────────────────────────

    async _enforceImdsv2(instanceId) {
        await this.ec2.send(new ModifyInstanceMetadataOptionsCommand({
            InstanceId: instanceId,
            HttpTokens: "required",
            HttpEndpoint: "enabled",
            HttpPutResponseHopLimit: 2
        }));

        // Verify
        const instance = await this._describeInstance(instanceId);
        const tokens = instance.MetadataOptions?.HttpTokens;
        if (tokens === "required") {
            return { action: "ENFORCE_IMDSV2", status: "SUCCESS", message: "IMDSv2 enforced — verified HttpTokens='required'" };
        }
        return { action: "ENFORCE_IMDSV2", status: "FAILED", message: `IMDSv2 was set but verification shows HttpTokens='${tokens}'` };
    }

    // ─── MONITORING ──────────────────────────────────────────────────

    async _enableMonitoring(instanceId) {
        const result = await this.ec2.send(new MonitorInstancesCommand({
            InstanceIds: [instanceId]
        }));
        const state = result.InstanceMonitorings?.[0]?.Monitoring?.State;
        return {
            action: "ENABLE_MONITORING",
            status: "SUCCESS",
            message: `Detailed CloudWatch monitoring ${state === 'enabled' ? 'confirmed enabled' : `state: ${state} (may take a moment to activate)`}`
        };
    }

    // ─── RESTRICT SSH ────────────────────────────────────────────────

    async _restrictSSH(instanceId) {
        const sgIds = await this._getInstanceSecurityGroups(instanceId);
        console.log(`[EC2Exec] SSH: checking ${sgIds.length} SG(s): ${sgIds.join(', ')}`);

        const removedFrom = [];
        const failedOn = [];

        for (const sgId of sgIds) {
            const sg = await this._describeSecurityGroup(sgId);
            if (!sg) continue;

            for (const rule of (sg.IpPermissions || [])) {
                // Match SSH rules: port 22 specifically, or range containing 22
                const coversSSH = (rule.FromPort === 22 && rule.ToPort === 22) ||
                    (rule.FromPort !== undefined && rule.ToPort !== undefined &&
                        rule.FromPort <= 22 && rule.ToPort >= 22);
                if (!coversSSH) continue;

                const publicIpv4 = (rule.IpRanges || []).filter(r => r.CidrIp === "0.0.0.0/0");
                const publicIpv6 = (rule.Ipv6Ranges || []).filter(r => r.CidrIpv6 === "::/0");

                if (publicIpv4.length === 0 && publicIpv6.length === 0) continue;

                // Build the EXACT revoke params, preserving all fields from the original rule
                const revokePermission = {
                    IpProtocol: rule.IpProtocol,
                    FromPort: rule.FromPort,
                    ToPort: rule.ToPort,
                };
                if (publicIpv4.length > 0) revokePermission.IpRanges = publicIpv4;
                if (publicIpv6.length > 0) revokePermission.Ipv6Ranges = publicIpv6;

                console.log(`[EC2Exec] SSH: revoking on ${sgId} — ${JSON.stringify(revokePermission)}`);

                try {
                    await this.ec2.send(new RevokeSecurityGroupIngressCommand({
                        GroupId: sgId,
                        IpPermissions: [revokePermission]
                    }));

                    // ── VERIFY the rule was actually removed ──
                    const verified = await this._verifyRuleRemoved(sgId, 22, "0.0.0.0/0");
                    if (verified) {
                        removedFrom.push(sgId);
                        console.log(`[EC2Exec] SSH: ✓ verified removed from ${sgId}`);
                    } else {
                        // Revoke returned OK but rule still present—try per-field revoke
                        console.warn(`[EC2Exec] SSH: revoke returned OK but rule still exists on ${sgId}. Trying individual IpRange revoke...`);
                        // Attempt revoking each IpRange individually
                        for (const ipRange of publicIpv4) {
                            try {
                                await this.ec2.send(new RevokeSecurityGroupIngressCommand({
                                    GroupId: sgId,
                                    IpPermissions: [{
                                        IpProtocol: "tcp",
                                        FromPort: 22,
                                        ToPort: 22,
                                        IpRanges: [{ CidrIp: "0.0.0.0/0" }]
                                    }]
                                }));
                            } catch (e2) {
                                console.error(`[EC2Exec] SSH fallback revoke failed: ${e2.message}`);
                            }
                        }
                        // Re-verify
                        const verified2 = await this._verifyRuleRemoved(sgId, 22, "0.0.0.0/0");
                        if (verified2) {
                            removedFrom.push(sgId);
                            console.log(`[EC2Exec] SSH: ✓ verified removed from ${sgId} (fallback)`);
                        } else {
                            failedOn.push(`${sgId} (rule persists after revoke — check rule format manually)`);
                        }
                    }
                } catch (err) {
                    console.error(`[EC2Exec] SSH: ✗ revoke on ${sgId}: ${err.message}`);
                    failedOn.push(`${sgId}: ${err.message}`);
                }
            }
        }

        if (failedOn.length > 0 && removedFrom.length === 0) {
            return { action: "RESTRICT_SSH", status: "FAILED", message: `Failed: ${failedOn.join('; ')}` };
        }
        if (removedFrom.length > 0) {
            const msg = `Revoked public SSH from ${removedFrom.join(', ')}. Add your trusted IP manually.`;
            return { action: "RESTRICT_SSH", status: "SUCCESS", message: failedOn.length > 0 ? `${msg} (partial: ${failedOn.join('; ')})` : msg };
        }
        return { action: "RESTRICT_SSH", status: "SUCCESS", message: "No public SSH rules found (already secure)" };
    }

    // ─── RESTRICT DANGEROUS SECURITY GROUP RULES ─────────────────────

    async _restrictSecurityGroups(instanceId) {
        const sgIds = await this._getInstanceSecurityGroups(instanceId);
        const dangerousPorts = [3389, 3306, 5432, 1433, 27017, 6379];
        const removedRules = [];
        const failedRules = [];

        for (const sgId of sgIds) {
            const sg = await this._describeSecurityGroup(sgId);
            if (!sg) continue;

            for (const rule of (sg.IpPermissions || [])) {
                const publicIpv4 = (rule.IpRanges || []).filter(r => r.CidrIp === "0.0.0.0/0");
                const publicIpv6 = (rule.Ipv6Ranges || []).filter(r => r.CidrIpv6 === "::/0");
                if (publicIpv4.length === 0 && publicIpv6.length === 0) continue;

                const isAllTraffic = rule.IpProtocol === "-1";
                const coversDangerousPort = !isAllTraffic && dangerousPorts.some(
                    port => rule.FromPort <= port && rule.ToPort >= port
                );

                if (!isAllTraffic && !coversDangerousPort) continue;

                const ruleDesc = isAllTraffic ? "ALL-TRAFFIC" : `${rule.FromPort}-${rule.ToPort}`;
                const revokePermission = { IpProtocol: rule.IpProtocol };
                if (!isAllTraffic) { revokePermission.FromPort = rule.FromPort; revokePermission.ToPort = rule.ToPort; }
                if (publicIpv4.length > 0) revokePermission.IpRanges = publicIpv4;
                if (publicIpv6.length > 0) revokePermission.Ipv6Ranges = publicIpv6;

                console.log(`[EC2Exec] SG: revoking ${ruleDesc} on ${sgId}`);
                try {
                    await this.ec2.send(new RevokeSecurityGroupIngressCommand({
                        GroupId: sgId,
                        IpPermissions: [revokePermission]
                    }));
                    removedRules.push(`${sgId}:${ruleDesc}`);
                } catch (err) {
                    console.error(`[EC2Exec] SG: ✗ revoke ${ruleDesc} on ${sgId}: ${err.message}`);
                    failedRules.push(`${sgId}:${ruleDesc}: ${err.message}`);
                }
            }
        }

        if (failedRules.length > 0 && removedRules.length === 0) {
            return { action: "RESTRICT_SECURITY_GROUPS", status: "FAILED", message: `Failed: ${failedRules.join('; ')}` };
        }
        if (removedRules.length > 0) {
            return { action: "RESTRICT_SECURITY_GROUPS", status: "SUCCESS", message: `Revoked ${removedRules.length} rule(s): ${removedRules.join(', ')}` };
        }
        return { action: "RESTRICT_SECURITY_GROUPS", status: "SUCCESS", message: "No dangerous public rules found" };
    }

    // ─── HELPERS ─────────────────────────────────────────────────────

    async _describeInstance(instanceId) {
        const response = await this.ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
        return response.Reservations?.[0]?.Instances?.[0];
    }

    async _describeSecurityGroup(sgId) {
        const response = await this.ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: [sgId] }));
        return response.SecurityGroups?.[0];
    }

    async _getInstanceSecurityGroups(instanceId) {
        const instance = await this._describeInstance(instanceId);
        if (!instance) throw new Error(`Instance ${instanceId} not found`);
        return (instance.SecurityGroups || []).map(sg => sg.GroupId);
    }

    /**
     * Verify that a rule allowing a specific port from a specific CIDR was actually removed.
     * Returns true if the rule is gone, false if it still exists.
     */
    async _verifyRuleRemoved(sgId, port, cidr) {
        const sg = await this._describeSecurityGroup(sgId);
        if (!sg) return true;

        for (const rule of (sg.IpPermissions || [])) {
            const coversPort = (rule.IpProtocol === "-1") ||
                (rule.FromPort !== undefined && rule.ToPort !== undefined &&
                    rule.FromPort <= port && rule.ToPort >= port);
            if (!coversPort) continue;

            const hasCidr = (rule.IpRanges || []).some(r => r.CidrIp === cidr);
            if (hasCidr) {
                console.log(`[EC2Exec] VERIFY: rule for port ${port} from ${cidr} STILL EXISTS on ${sgId}`);
                console.log(`[EC2Exec] VERIFY: rule details: ${JSON.stringify(rule)}`);
                return false;
            }
        }
        return true;
    }
}

module.exports = new EC2ExecutionAgent();
