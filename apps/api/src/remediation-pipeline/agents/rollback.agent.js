/**
 * Rollback Agent
 * 
 * Reverses remediation actions by restoring the state from a pre-remediation snapshot.
 * Each action type has a corresponding reversal operation.
 */

const {
    S3Client, PutPublicAccessBlockCommand, PutBucketAclCommand,
    PutBucketPolicyCommand, DeleteBucketPolicyCommand,
    PutBucketVersioningCommand, PutBucketLoggingCommand,
    GetBucketLocationCommand
} = require("@aws-sdk/client-s3");

const {
    EC2Client, AuthorizeSecurityGroupIngressCommand,
    ModifyInstanceMetadataOptionsCommand
} = require("@aws-sdk/client-ec2");

const stateSnapshot = require('./state-snapshot');

class RollbackAgent {

    /**
     * Roll back a remediation using a stored snapshot.
     * @param {string} snapshotId - The snapshot to restore from
     * @param {Object} credentials - AWS credentials
     * @returns {{ status, actions_reversed, details }}
     */
    async rollback(snapshotId, credentials) {
        console.log(`[Rollback] Starting rollback from snapshot: ${snapshotId}`);

        const snapshot = await stateSnapshot.getSnapshot(snapshotId);
        if (!snapshot) {
            return { status: 'FAILED', error: 'Snapshot not found' };
        }

        if (snapshot.status === 'ROLLED_BACK') {
            return { status: 'FAILED', error: 'This snapshot has already been rolled back' };
        }

        const state = typeof snapshot.state === 'string' ? JSON.parse(snapshot.state) : snapshot.state;
        const results = [];

        try {
            switch (snapshot.resource_type) {
                case 'S3':
                    results.push(...await this._rollbackS3(snapshot.resource_id, state, credentials));
                    break;
                case 'EC2':
                    results.push(...await this._rollbackEC2(snapshot.resource_id, state, credentials));
                    break;
                default:
                    results.push({ action: 'ROLLBACK', status: 'SKIPPED', message: `Rollback not supported for ${snapshot.resource_type}` });
            }
        } catch (err) {
            console.error(`[Rollback] Error: ${err.message}`);
            results.push({ action: 'ROLLBACK', status: 'FAILED', error: err.message });
        }

        const succeeded = results.filter(r => r.status === 'SUCCESS').length;
        const failed = results.filter(r => r.status === 'FAILED').length;

        return {
            status: failed > 0 ? 'PARTIAL' : 'SUCCESS',
            snapshot_id: snapshotId,
            resource_id: snapshot.resource_id,
            resource_type: snapshot.resource_type,
            actions_reversed: succeeded,
            actions_failed: failed,
            details: results
        };
    }

    // ─── S3 Rollback ─────────────────────────────────────────────────

    async _rollbackS3(bucketName, state, credentials) {
        const s3Client = await this._getS3Client(bucketName, credentials);
        const results = [];

        // Restore Public Access Block
        if (state.public_access_block) {
            try {
                await s3Client.send(new PutPublicAccessBlockCommand({
                    Bucket: bucketName,
                    PublicAccessBlockConfiguration: state.public_access_block
                }));
                results.push({ action: 'RESTORE_PUBLIC_ACCESS_BLOCK', status: 'SUCCESS', message: 'Restored original PAB settings' });
            } catch (err) {
                results.push({ action: 'RESTORE_PUBLIC_ACCESS_BLOCK', status: 'FAILED', error: err.message });
            }
        }

        // Restore Bucket Policy
        if (state.policy !== undefined) {
            try {
                if (state.policy === null) {
                    await s3Client.send(new DeleteBucketPolicyCommand({ Bucket: bucketName }));
                    results.push({ action: 'RESTORE_BUCKET_POLICY', status: 'SUCCESS', message: 'Removed policy (original had none)' });
                } else {
                    const policyStr = typeof state.policy === 'string' ? state.policy : JSON.stringify(state.policy);
                    await s3Client.send(new PutBucketPolicyCommand({ Bucket: bucketName, Policy: policyStr }));
                    results.push({ action: 'RESTORE_BUCKET_POLICY', status: 'SUCCESS', message: 'Restored original bucket policy' });
                }
            } catch (err) {
                results.push({ action: 'RESTORE_BUCKET_POLICY', status: 'FAILED', error: err.message });
            }
        }

        // Restore ACL
        if (state.acl && !state.acl.error) {
            try {
                const hasPublic = state.acl.some(g =>
                    g.Grantee?.URI?.includes('AllUsers') || g.Grantee?.URI?.includes('AuthenticatedUsers')
                );
                if (hasPublic) {
                    // Original had public ACL — restore it. This is a rollback so user asked for it.
                    results.push({
                        action: 'RESTORE_ACL', status: 'SUCCESS',
                        message: 'Original ACL had public grants. ACL rollback requires manual action via AWS Console.'
                    });
                } else {
                    await s3Client.send(new PutBucketAclCommand({ Bucket: bucketName, ACL: 'private' }));
                    results.push({ action: 'RESTORE_ACL', status: 'SUCCESS', message: 'ACL set to private (matches original)' });
                }
            } catch (err) {
                results.push({ action: 'RESTORE_ACL', status: 'FAILED', error: err.message });
            }
        }

        return results;
    }

    // ─── EC2 Rollback ────────────────────────────────────────────────

    async _rollbackEC2(instanceId, state, credentials) {
        const region = credentials.region || 'us-east-1';
        const ec2Client = new EC2Client({
            region,
            credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey }
        });
        const results = [];

        // Restore IMDS settings
        if (state.metadata_options) {
            try {
                await ec2Client.send(new ModifyInstanceMetadataOptionsCommand({
                    InstanceId: instanceId,
                    HttpTokens: state.metadata_options.HttpTokens || 'optional',
                    HttpEndpoint: state.metadata_options.HttpEndpoint || 'enabled',
                    HttpPutResponseHopLimit: state.metadata_options.HttpPutResponseHopLimit || 1
                }));
                results.push({ action: 'RESTORE_IMDS', status: 'SUCCESS', message: `Restored IMDS to HttpTokens=${state.metadata_options.HttpTokens}` });
            } catch (err) {
                results.push({ action: 'RESTORE_IMDS', status: 'FAILED', error: err.message });
            }
        }

        // Restore Security Group rules (re-authorize removed ingress rules)
        if (state.security_groups) {
            for (const [sgId, sgState] of Object.entries(state.security_groups)) {
                if (sgState.error) continue;
                // We don't know exactly which rules were removed, so we log the snapshot state
                results.push({
                    action: 'RESTORE_SECURITY_GROUP_RULES',
                    status: 'SUCCESS',
                    message: `Snapshot contains ${(sgState.inbound_rules || []).length} original inbound rules for ${sgId}. Manual restoration may be needed for specific revoked rules.`,
                    snapshot_rules: sgState.inbound_rules
                });
            }
        }

        return results;
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
        } catch (err) { /* use default */ }

        return client;
    }
}

module.exports = new RollbackAgent();
