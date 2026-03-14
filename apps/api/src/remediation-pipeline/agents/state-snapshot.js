/**
 * State Snapshot Agent
 * 
 * Captures the full pre-remediation state of a resource so any change can be undone.
 * Snapshots are stored in DynamoDB for rollback capability.
 */

const { docClient } = require('../../config/db');
const { PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

const {
    S3Client, GetPublicAccessBlockCommand, GetBucketAclCommand,
    GetBucketPolicyCommand, GetBucketEncryptionCommand,
    GetBucketVersioningCommand, GetBucketLoggingCommand, GetBucketLocationCommand
} = require("@aws-sdk/client-s3");

const {
    EC2Client, DescribeSecurityGroupsCommand, DescribeInstancesCommand
} = require("@aws-sdk/client-ec2");

const TABLE_NAME = "CloudGuard_Remediation_Snapshots";

class StateSnapshotAgent {

    /**
     * Capture a full state snapshot before remediation.
     * @param {string} resourceId - Bucket name, instance ID, or username
     * @param {string} resourceType - 'S3' | 'EC2' | 'IAM'
     * @param {Object} credentials - AWS credentials
     * @param {string} planId - Associated remediation plan ID
     * @returns {{ snapshot_id, resource_id, resource_type, state, created_at }}
     */
    async capture(resourceId, resourceType, credentials, planId) {
        console.log(`[StateSnapshot] Capturing state for ${resourceType}: ${resourceId}`);

        let state = {};
        try {
            switch (resourceType) {
                case 'S3':
                    state = await this._captureS3State(resourceId, credentials);
                    break;
                case 'EC2':
                    state = await this._captureEC2State(resourceId, credentials);
                    break;
                case 'IAM':
                    state = { note: 'IAM state captured from scan raw_config at plan time' };
                    break;
                default:
                    state = { note: 'Unknown resource type' };
            }
        } catch (err) {
            console.error(`[StateSnapshot] Error capturing state: ${err.message}`);
            state = { error: err.message, partial: true };
        }

        const snapshot = {
            snapshot_id: uuidv4(),
            plan_id: planId,
            resource_id: resourceId,
            resource_type: resourceType,
            state: JSON.stringify(state),
            created_at: new Date().toISOString(),
            status: 'ACTIVE' // ACTIVE = can be rolled back; EXPIRED = too old
        };

        // Store in DynamoDB
        try {
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: snapshot
            }));
            console.log(`[StateSnapshot] Saved snapshot ${snapshot.snapshot_id}`);
        } catch (err) {
            console.warn(`[StateSnapshot] Could not save to DynamoDB: ${err.message}. Snapshot available in-memory only.`);
        }

        return snapshot;
    }

    /**
     * Retrieve a snapshot by ID.
     */
    async getSnapshot(snapshotId) {
        try {
            const response = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { snapshot_id: snapshotId }
            }));
            return response.Item || null;
        } catch (err) {
            console.error(`[StateSnapshot] Error retrieving snapshot: ${err.message}`);
            return null;
        }
    }

    // ─── S3 State Capture ────────────────────────────────────────────

    async _captureS3State(bucketName, credentials) {
        const s3Client = await this._getS3Client(bucketName, credentials);
        const state = {};

        // Public Access Block
        try {
            const resp = await s3Client.send(new GetPublicAccessBlockCommand({ Bucket: bucketName }));
            state.public_access_block = resp.PublicAccessBlockConfiguration;
        } catch (err) {
            state.public_access_block = err.name === 'NoSuchPublicAccessBlockConfiguration' ? null : { error: err.message };
        }

        // ACL
        try {
            const resp = await s3Client.send(new GetBucketAclCommand({ Bucket: bucketName }));
            state.acl = resp.Grants;
            state.acl_owner = resp.Owner;
        } catch (err) {
            state.acl = { error: err.message };
        }

        // Bucket Policy
        try {
            const resp = await s3Client.send(new GetBucketPolicyCommand({ Bucket: bucketName }));
            state.policy = resp.Policy;
        } catch (err) {
            state.policy = err.name === 'NoSuchBucketPolicy' ? null : { error: err.message };
        }

        // Encryption
        try {
            const resp = await s3Client.send(new GetBucketEncryptionCommand({ Bucket: bucketName }));
            state.encryption = resp.ServerSideEncryptionConfiguration;
        } catch (err) {
            state.encryption = null;
        }

        // Versioning
        try {
            const resp = await s3Client.send(new GetBucketVersioningCommand({ Bucket: bucketName }));
            state.versioning = { Status: resp.Status, MFADelete: resp.MFADelete };
        } catch (err) {
            state.versioning = null;
        }

        // Logging
        try {
            const resp = await s3Client.send(new GetBucketLoggingCommand({ Bucket: bucketName }));
            state.logging = resp.LoggingEnabled || null;
        } catch (err) {
            state.logging = null;
        }

        return state;
    }

    // ─── EC2 State Capture ───────────────────────────────────────────

    async _captureEC2State(instanceId, credentials) {
        const region = credentials.region || 'us-east-1';
        const ec2Client = new EC2Client({
            region,
            credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey }
        });

        const state = {};

        // Instance metadata
        try {
            const resp = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
            const instance = resp.Reservations?.[0]?.Instances?.[0];
            if (instance) {
                state.metadata_options = instance.MetadataOptions;
                state.monitoring = instance.Monitoring;
                state.security_group_ids = (instance.SecurityGroups || []).map(sg => sg.GroupId);
            }
        } catch (err) {
            state.instance = { error: err.message };
        }

        // Security Group rules (full details)
        if (state.security_group_ids) {
            state.security_groups = {};
            for (const sgId of state.security_group_ids) {
                try {
                    const resp = await ec2Client.send(new DescribeSecurityGroupsCommand({ GroupIds: [sgId] }));
                    const sg = resp.SecurityGroups?.[0];
                    if (sg) {
                        state.security_groups[sgId] = {
                            inbound_rules: sg.IpPermissions,
                            outbound_rules: sg.IpPermissionsEgress
                        };
                    }
                } catch (err) {
                    state.security_groups[sgId] = { error: err.message };
                }
            }
        }

        return state;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    async _getS3Client(bucketName, credentials) {
        const baseConfig = {
            region: credentials.region || 'us-east-1',
            credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey }
        };
        let client = new S3Client(baseConfig);

        try {
            const locResp = await client.send(new GetBucketLocationCommand({ Bucket: bucketName }));
            let region = locResp.LocationConstraint || 'us-east-1';
            if (region === 'EU') region = 'eu-west-1';
            if (region !== baseConfig.region) {
                client = new S3Client({ ...baseConfig, region });
            }
        } catch (err) {
            // Use default
        }

        return client;
    }
}

module.exports = new StateSnapshotAgent();
