const { EC2Client, DescribeVolumesCommand, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = "CloudGuard_Cost_Scans";

const estimateEC2Cost = (instanceType) => {
    // Rough monthly estimation for demonstration purposes
    const pricing = {
        't2.micro': 8.5,
        't3.micro': 7.5,
        't3.medium': 30,
        'm5.large': 70,
        'c5.large': 62
    };
    return pricing[instanceType] || 20; // Default $20 fallback
};

exports.startCostScan = async (req, res) => {
    const credentials = req.user?.awsCredentials;

    if (!credentials) {
        return res.status(403).json({ error: "Missing AWS Credentials. Please update your Settings." });
    }

    try {
        const ec2Client = new EC2Client({
            region: credentials.region || 'us-east-1',
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        });

        const cloudWatchClient = new CloudWatchClient({
            region: credentials.region || 'us-east-1',
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        });

        const scanResults = [];

        // 1. Detect Zombie EBS Volumes
        const volumesCmd = new DescribeVolumesCommand({
            Filters: [{ Name: "status", Values: ["available"] }]
        });
        const volumesResp = await ec2Client.send(volumesCmd);
        const unattachedVolumes = volumesResp.Volumes || [];

        unattachedVolumes.forEach(vol => {
            const size = vol.Size || 0;
            const cost = size * 0.08; // rough estimate $0.08 per GB
            scanResults.push({
                resource_type: "EBS Volume",
                resource_id: vol.VolumeId,
                region: credentials.region,
                details: `${size} GB Available`,
                estimated_monthly_cost: cost.toFixed(2),
                status: "Zombie Resource",
                remediation_mode: "MANUAL_REVIEW",
                remediation_reason: "Deleting unattached storage requires confirmation that the data is no longer needed.",
                auto_fix_available: false
            });
        });

        // 2. Detect Idle EC2 Instances (< 2% CPU over 7 days)
        const instancesCmd = new DescribeInstancesCommand({
            Filters: [{ Name: "instance-state-name", Values: ["running"] }]
        });
        const instancesResp = await ec2Client.send(instancesCmd);
        
        const runningInstances = [];
        (instancesResp.Reservations || []).forEach(res => {
            (res.Instances || []).forEach(inst => runningInstances.push(inst));
        });

        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

        for (const inst of runningInstances) {
            const metricsCmd = new GetMetricStatisticsCommand({
                Namespace: "AWS/EC2",
                MetricName: "CPUUtilization",
                Dimensions: [{ Name: "InstanceId", Value: inst.InstanceId }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 86400, // 1 day data points
                Statistics: ["Average"]
            });

            try {
                const metricsResp = await cloudWatchClient.send(metricsCmd);
                const datapoints = metricsResp.Datapoints || [];
                
                if (datapoints.length > 0) {
                    const sum = datapoints.reduce((acc, dp) => acc + dp.Average, 0);
                    const avgCpu = sum / datapoints.length;

                    if (avgCpu < 2.0) {
                        scanResults.push({
                            resource_type: "EC2 Instance",
                            resource_id: inst.InstanceId,
                            region: credentials.region,
                            details: `Avg CPU: ${avgCpu.toFixed(2)}%`,
                            estimated_monthly_cost: estimateEC2Cost(inst.InstanceType).toFixed(2),
                            status: "Idle Instance",
                remediation_mode: "ASSISTED_FIX",
                remediation_reason: "Stopping instances is generally safe but requires verifying there are no background jobs running.",
                auto_fix_available: false
                        });
                    }
                } else {
                    // No metric data could also mean it's entirely idle or recently launched, 
                    // but we will skip unless we have explicit data showing < 2%
                }
            } catch (err) {
                console.error(`Failed to get CloudWatch metrics for ${inst.InstanceId}:`, err);
            }
        }

        // Save scan to DB
        const scanId = uuidv4();
        const totalWasted = scanResults.reduce((acc, r) => acc + parseFloat(r.estimated_monthly_cost), 0);
        
        const item = {
            scan_id: scanId,
            user_email: req.user.email,
            status: scanResults.length > 0 ? "WASTAGE_DETECTED" : "OPTIMIZED",
            resources: scanResults,
            total_wasted_cost: totalWasted.toFixed(2),
            zombie_volumes: scanResults.filter(r => r.resource_type === 'EBS Volume').length,
            idle_instances: scanResults.filter(r => r.resource_type === 'EC2 Instance').length,
            created_at: new Date().toISOString()
        };

        await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

        res.status(200).json({ scan_id: scanId, result: item });

    } catch (error) {
        console.error("Cost Scan Pipeline Failed:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getCostScans = async (req, res) => {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "user_email = :email",
            ExpressionAttributeValues: { ":email": req.user.email }
        });
        const response = await docClient.send(command);

        const scans = response.Items || [];
        // Sort by newest
        scans.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(scans);
    } catch (error) {
        console.error("[CostScanController] Error fetching scans:", error);
        res.status(500).json({ error: "Failed to fetch Cost scan history" });
    }
};

exports.getCostScanById = async (req, res) => {
    const { id } = req.params;
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { scan_id: id }
        });
        const response = await docClient.send(command);

        if (!response.Item || response.Item.user_email !== req.user.email) {
            return res.status(404).json({ error: "Cost scan not found" });
        }

        res.json(response.Item);
    } catch (error) {
        console.error("Get Cost Scan By ID Failed:", error);
        res.status(500).json({ error: error.message });
    }
};
