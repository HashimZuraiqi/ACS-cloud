const {
    EC2Client,
    DescribeInstancesCommand,
    DescribeSecurityGroupsCommand,
    DescribeVolumesCommand
} = require("@aws-sdk/client-ec2");

class EC2ScannerAgent {
    constructor() {
        this.defaultRegion = process.env.AWS_REGION || "us-east-1";
        this.ec2 = new EC2Client({ region: this.defaultRegion });
    }

    /**
     * Scan a single EC2 instance by its Instance ID.
     * Gathers security-relevant configuration data.
     */
    async scanInstance(instanceId) {
        if (!instanceId) throw new Error("Instance ID is required");

        console.log(`[EC2ScannerAgent] Scanning instance: ${instanceId}`);

        try {
            // STEP 1: Describe the Instance
            const describeCommand = new DescribeInstancesCommand({
                InstanceIds: [instanceId]
            });
            const describeResponse = await this.ec2.send(describeCommand);

            const reservations = describeResponse.Reservations || [];
            if (reservations.length === 0 || reservations[0].Instances.length === 0) {
                throw new Error(`Instance "${instanceId}" not found.`);
            }

            const instance = reservations[0].Instances[0];

            // Build the base config object
            const config = {
                instance_id: instance.InstanceId,
                scan_time: new Date().toISOString(),
                region: this.defaultRegion,
                state: instance.State?.Name || "unknown",
                instance_type: instance.InstanceType,
                platform: instance.PlatformDetails || instance.Platform || "Linux/UNIX",
                launch_time: instance.LaunchTime?.toISOString() || null,
                vpc_id: instance.VpcId || null,
                subnet_id: instance.SubnetId || null,

                // Public Exposure
                public_ip: instance.PublicIpAddress || null,
                public_dns: instance.PublicDnsName || null,

                // IMDSv2 Enforcement
                imdsv2_required: instance.MetadataOptions?.HttpTokens === "required",
                metadata_options: instance.MetadataOptions || {},

                // IAM Instance Profile
                iam_profile: instance.IamInstanceProfile ? {
                    arn: instance.IamInstanceProfile.Arn,
                    id: instance.IamInstanceProfile.Id
                } : null,

                // Monitoring
                monitoring_enabled: instance.Monitoring?.State === "enabled",

                // Security Groups (will be enriched below)
                security_groups: [],

                // EBS Encryption (will be enriched below)
                ebs_volumes: [],

                // Tags for context
                tags: instance.Tags || []
            };

            // STEP 2: Fetch Security Group Rules
            const sgIds = (instance.SecurityGroups || []).map(sg => sg.GroupId);
            if (sgIds.length > 0) {
                try {
                    const sgCommand = new DescribeSecurityGroupsCommand({
                        GroupIds: sgIds
                    });
                    const sgResponse = await this.ec2.send(sgCommand);

                    config.security_groups = (sgResponse.SecurityGroups || []).map(sg => ({
                        group_id: sg.GroupId,
                        group_name: sg.GroupName,
                        description: sg.Description,
                        inbound_rules: (sg.IpPermissions || []).map(rule => ({
                            protocol: rule.IpProtocol,
                            from_port: rule.FromPort,
                            to_port: rule.ToPort,
                            ip_ranges: (rule.IpRanges || []).map(r => r.CidrIp),
                            ipv6_ranges: (rule.Ipv6Ranges || []).map(r => r.CidrIpv6),
                            prefix_list_ids: (rule.PrefixListIds || []).map(r => r.PrefixListId),
                            security_groups: (rule.UserIdGroupPairs || []).map(r => r.GroupId)
                        })),
                        outbound_rules: (sg.IpPermissionsEgress || []).map(rule => ({
                            protocol: rule.IpProtocol,
                            from_port: rule.FromPort,
                            to_port: rule.ToPort,
                            ip_ranges: (rule.IpRanges || []).map(r => r.CidrIp),
                            ipv6_ranges: (rule.Ipv6Ranges || []).map(r => r.CidrIpv6)
                        }))
                    }));
                } catch (err) {
                    console.warn(`[EC2ScannerAgent] Error fetching Security Groups: ${err.message}`);
                }
            }

            // STEP 3: Check EBS Volume Encryption
            const volumeIds = (instance.BlockDeviceMappings || [])
                .map(bdm => bdm.Ebs?.VolumeId)
                .filter(Boolean);

            if (volumeIds.length > 0) {
                try {
                    const volCommand = new DescribeVolumesCommand({
                        VolumeIds: volumeIds
                    });
                    const volResponse = await this.ec2.send(volCommand);

                    config.ebs_volumes = (volResponse.Volumes || []).map(vol => ({
                        volume_id: vol.VolumeId,
                        encrypted: vol.Encrypted || false,
                        size_gb: vol.Size,
                        volume_type: vol.VolumeType,
                        state: vol.State
                    }));
                } catch (err) {
                    console.warn(`[EC2ScannerAgent] Error fetching EBS Volumes: ${err.message}`);
                }
            }

            return config;

        } catch (error) {
            console.error(`[EC2ScannerAgent] Scan Pipeline Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Scan all running EC2 instances in the configured region.
     * Returns an array of instance configs.
     */
    async scanAllInstances() {
        console.log(`[EC2ScannerAgent] Scanning all running instances in ${this.defaultRegion}...`);

        try {
            const command = new DescribeInstancesCommand({
                Filters: [{ Name: "instance-state-name", Values: ["running"] }]
            });
            const response = await this.ec2.send(command);

            const instanceIds = [];
            for (const reservation of (response.Reservations || [])) {
                for (const instance of (reservation.Instances || [])) {
                    instanceIds.push(instance.InstanceId);
                }
            }

            if (instanceIds.length === 0) {
                console.log("[EC2ScannerAgent] No running instances found.");
                return [];
            }

            console.log(`[EC2ScannerAgent] Found ${instanceIds.length} running instance(s). Scanning each...`);

            const results = [];
            for (const id of instanceIds) {
                try {
                    const config = await this.scanInstance(id);
                    results.push(config);
                } catch (err) {
                    console.warn(`[EC2ScannerAgent] Failed to scan ${id}: ${err.message}`);
                    results.push({ instance_id: id, error: err.message });
                }
            }

            return results;

        } catch (error) {
            console.error(`[EC2ScannerAgent] Error listing instances: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new EC2ScannerAgent();
