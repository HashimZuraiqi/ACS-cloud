const {
    S3Client,
    PutPublicAccessBlockCommand,
    GetPublicAccessBlockCommand,
    GetBucketLocationCommand,
    PutBucketAclCommand,
    GetBucketAclCommand,
    GetBucketPolicyCommand,
    PutBucketPolicyCommand,
    DeleteBucketPolicyCommand,
    PutBucketEncryptionCommand,
    GetBucketEncryptionCommand,
    PutBucketVersioningCommand,
    GetBucketVersioningCommand,
    PutBucketLoggingCommand,
    GetBucketLoggingCommand,
    HeadBucketCommand
} = require("@aws-sdk/client-s3");

class ExecutionAgent {

    /**
     * Get a region-aware S3 client for the given bucket.
     */
    async _getClientForBucket(bucketName, credentials) {
        if (!credentials) throw new Error("AWS Credentials are required");
        let region = credentials.region || "us-east-1";

        const clientConfig = {
            region: region,
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        };

        let s3Client = new S3Client(clientConfig);

        try {
            const locationData = await s3Client.send(
                new GetBucketLocationCommand({ Bucket: bucketName })
            );
            if (locationData.LocationConstraint) {
                region = locationData.LocationConstraint;
                if (region === 'EU') region = 'eu-west-1';
            }
            if (region !== clientConfig.region) {
                console.log(`[ExecutionAgent] Bucket is in ${region}. Switching client.`);
                s3Client = new S3Client({ ...clientConfig, region });
            }
        } catch (err) {
            console.warn(`[ExecutionAgent] Could not determine region: ${err.message}. Using default.`);
        }

        return { s3Client, region };
    }

    /**
     * Fix #11: Pre-flight safety checks before executing any remediation.
     */
    async _runSafetyChecks(bucketName, s3Client) {
        const checks = [];

        // Check 1: Bucket exists and is accessible
        try {
            await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
            checks.push({ check: 'BUCKET_ACCESSIBLE', passed: true });
        } catch (err) {
            checks.push({ check: 'BUCKET_ACCESSIBLE', passed: false, error: err.message });
            if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
                return { safe: false, reason: `Bucket "${bucketName}" does not exist.`, checks };
            }
            if (err.$metadata?.httpStatusCode === 403) {
                return { safe: false, reason: `Access denied. Missing permissions to access "${bucketName}".`, checks };
            }
            return { safe: false, reason: `Bucket "${bucketName}" is not accessible: ${err.message}`, checks };
        }

        // Check 2: Can read current configuration (ownership + permissions)
        try {
            await s3Client.send(new GetPublicAccessBlockCommand({ Bucket: bucketName }));
            checks.push({ check: 'READ_CONFIG', passed: true });
        } catch (err) {
            if (err.name !== 'NoSuchPublicAccessBlockConfiguration') {
                checks.push({ check: 'READ_CONFIG', passed: false, error: err.message });
            } else {
                checks.push({ check: 'READ_CONFIG', passed: true, note: 'No PAB config yet' });
            }
        }

        return { safe: true, checks };
    }

    async executePlan(plan, bucketName, credentials) {
        console.log(`[ExecutionAgent] Executing ${plan.steps.length} step(s) for ${bucketName}`);

        const { s3Client } = await this._getClientForBucket(bucketName, credentials);

        // Fix #11: Safety checks
        const safety = await this._runSafetyChecks(bucketName, s3Client);
        if (!safety.safe) {
            console.error(`[ExecutionAgent] Safety check failed: ${safety.reason}`);
            return [{
                action: 'SAFETY_CHECK',
                status: 'FAILED',
                message: `Remediation skipped due to failed validation. ${safety.reason}`
            }];
        }

        const results = [];

        for (const step of plan.steps) {
            try {
                const result = await this._executeStep(step, bucketName, s3Client);
                results.push(result);
                console.log(`[ExecutionAgent] ${result.status === 'ALREADY_COMPLIANT' ? '⊘' : '✓'} ${step.action}: ${result.status}`);
            } catch (error) {
                console.error(`[ExecutionAgent] ✗ ${step.action}: ${error.message}`);
                results.push({ action: step.action, status: "FAILED", error: error.message });
            }
        }

        return results;
    }

    async _executeStep(step, bucketName, s3Client) {
        switch (step.action) {
            case "PUT_PUBLIC_ACCESS_BLOCK":
                return await this._blockPublicAccess(bucketName, s3Client);
            case "REMOVE_PUBLIC_ACLS":
                return await this._removePublicAcls(bucketName, s3Client);
            case "SANITIZE_BUCKET_POLICY":
                return await this._sanitizeBucketPolicy(bucketName, s3Client);
            case "ENABLE_ENCRYPTION":
                return await this._enableEncryption(bucketName, s3Client);
            case "ENABLE_VERSIONING":
                return await this._enableVersioning(bucketName, s3Client);
            case "ENABLE_LOGGING":
                return await this._enableLogging(bucketName, s3Client);
            default:
                return { action: step.action, status: "SKIPPED", message: `Unknown action: ${step.action}` };
        }
    }

    // ─── Fix #2: Idempotent checks before every action ────────────────

    async _blockPublicAccess(bucketName, s3Client) {
        // Check if already compliant
        try {
            const current = await s3Client.send(new GetPublicAccessBlockCommand({ Bucket: bucketName }));
            const cfg = current.PublicAccessBlockConfiguration || {};
            if (cfg.BlockPublicAcls && cfg.IgnorePublicAcls && cfg.BlockPublicPolicy && cfg.RestrictPublicBuckets) {
                return {
                    action: "PUT_PUBLIC_ACCESS_BLOCK",
                    status: "ALREADY_COMPLIANT",
                    message: "Block Public Access Already Enabled — Skipped",
                    before: cfg,
                    after: cfg
                };
            }
        } catch (err) {
            // No PAB config = needs fixing
        }

        const newConfig = {
            BlockPublicAcls: true, IgnorePublicAcls: true,
            BlockPublicPolicy: true, RestrictPublicBuckets: true
        };
        await s3Client.send(new PutPublicAccessBlockCommand({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: newConfig
        }));
        return {
            action: "PUT_PUBLIC_ACCESS_BLOCK",
            status: "SUCCESS",
            message: "Block Public Access enabled",
            before: { BlockPublicAcls: false, IgnorePublicAcls: false, BlockPublicPolicy: false, RestrictPublicBuckets: false },
            after: newConfig
        };
    }

    async _removePublicAcls(bucketName, s3Client) {
        // Check if already private
        try {
            const current = await s3Client.send(new GetBucketAclCommand({ Bucket: bucketName }));
            const grants = current.Grants || [];
            const publicGrants = grants.filter(g =>
                g.Grantee?.URI?.includes('AllUsers') || g.Grantee?.URI?.includes('AuthenticatedUsers')
            );
            if (publicGrants.length === 0) {
                return {
                    action: "REMOVE_PUBLIC_ACLS",
                    status: "ALREADY_COMPLIANT",
                    message: "ACL Already Private — Skipped"
                };
            }
        } catch (err) { /* proceed with fix */ }

        await s3Client.send(new PutBucketAclCommand({ Bucket: bucketName, ACL: "private" }));
        return { action: "REMOVE_PUBLIC_ACLS", status: "SUCCESS", message: "Bucket ACL set to private" };
    }

    async _sanitizeBucketPolicy(bucketName, s3Client) {
        try {
            const policyResponse = await s3Client.send(new GetBucketPolicyCommand({ Bucket: bucketName }));
            const policy = JSON.parse(policyResponse.Policy);
            const before = JSON.parse(JSON.stringify(policy));

            const originalCount = policy.Statement.length;
            policy.Statement = policy.Statement.filter(stmt => {
                const principal = JSON.stringify(stmt.Principal || "");
                const isWildcard = principal === '"*"' || principal.includes('"*"');
                const isAllow = stmt.Effect === "Allow";
                return !(isWildcard && isAllow);
            });

            if (policy.Statement.length === originalCount) {
                return {
                    action: "SANITIZE_BUCKET_POLICY",
                    status: "ALREADY_COMPLIANT",
                    message: "Bucket Policy Already Sanitized — Skipped"
                };
            }

            if (policy.Statement.length === 0) {
                await s3Client.send(new DeleteBucketPolicyCommand({ Bucket: bucketName }));
                return {
                    action: "SANITIZE_BUCKET_POLICY",
                    status: "SUCCESS",
                    message: `Deleted bucket policy (all ${originalCount} statements had wildcard principals)`,
                    before: before,
                    after: null
                };
            } else {
                await s3Client.send(new PutBucketPolicyCommand({
                    Bucket: bucketName, Policy: JSON.stringify(policy)
                }));
                return {
                    action: "SANITIZE_BUCKET_POLICY",
                    status: "SUCCESS",
                    message: `Removed ${originalCount - policy.Statement.length} public statement(s) from policy`,
                    before: before,
                    after: policy
                };
            }
        } catch (err) {
            if (err.name === "NoSuchBucketPolicy") {
                return {
                    action: "SANITIZE_BUCKET_POLICY",
                    status: "ALREADY_COMPLIANT",
                    message: "No Bucket Policy Exists — Skipped"
                };
            }
            throw err;
        }
    }

    // Fix #3: Enhanced encryption detection
    async _enableEncryption(bucketName, s3Client) {
        // Check current encryption state
        try {
            const current = await s3Client.send(new GetBucketEncryptionCommand({ Bucket: bucketName }));
            const rules = current.ServerSideEncryptionConfiguration?.Rules || [];
            if (rules.length > 0) {
                const algo = rules[0].ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
                if (algo === 'aws:kms' || algo === 'aws:kms:dsse') {
                    return {
                        action: "ENABLE_ENCRYPTION",
                        status: "ALREADY_COMPLIANT",
                        message: `Encryption Already Enabled (${algo === 'aws:kms' ? 'SSE-KMS' : 'DSSE-KMS'}) — Skipped`,
                        encryption_type: algo === 'aws:kms' ? 'SSE-KMS' : 'DSSE-KMS'
                    };
                }
                if (algo === 'AES256') {
                    // SSE-S3 exists, suggest upgrade instead of re-applying
                    return {
                        action: "ENABLE_ENCRYPTION",
                        status: "RECOMMENDATION",
                        message: "SSE-S3 (AES256) already enabled. Consider upgrading to SSE-KMS for stronger key management.",
                        encryption_type: 'SSE-S3',
                        recommendation: 'Upgrade encryption to SSE-KMS'
                    };
                }
            }
        } catch (err) {
            // No encryption config = needs fixing
        }

        // No encryption — enable SSE-S3 as baseline
        await s3Client.send(new PutBucketEncryptionCommand({
            Bucket: bucketName,
            ServerSideEncryptionConfiguration: {
                Rules: [{
                    ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
                    BucketKeyEnabled: true
                }]
            }
        }));
        return {
            action: "ENABLE_ENCRYPTION",
            status: "SUCCESS",
            message: "SSE-S3 (AES256) encryption enabled",
            before: { encryption: 'None' },
            after: { encryption: 'SSE-S3 (AES256)' }
        };
    }

    async _enableVersioning(bucketName, s3Client) {
        // Check if already enabled
        try {
            const current = await s3Client.send(new GetBucketVersioningCommand({ Bucket: bucketName }));
            if (current.Status === 'Enabled') {
                return {
                    action: "ENABLE_VERSIONING",
                    status: "ALREADY_COMPLIANT",
                    message: "Versioning Already Enabled — Skipped"
                };
            }
        } catch (err) { /* proceed */ }

        await s3Client.send(new PutBucketVersioningCommand({
            Bucket: bucketName,
            VersioningConfiguration: { Status: "Enabled" }
        }));
        return {
            action: "ENABLE_VERSIONING",
            status: "SUCCESS",
            message: "Bucket versioning enabled",
            before: { versioning: 'Disabled' },
            after: { versioning: 'Enabled' }
        };
    }

    async _enableLogging(bucketName, s3Client) {
        // Check if already enabled
        try {
            const current = await s3Client.send(new GetBucketLoggingCommand({ Bucket: bucketName }));
            if (current.LoggingEnabled) {
                return {
                    action: "ENABLE_LOGGING",
                    status: "ALREADY_COMPLIANT",
                    message: `Access Logging Already Enabled — Skipped (target: ${current.LoggingEnabled.TargetBucket})`
                };
            }
        } catch (err) { /* proceed */ }

        try {
            await s3Client.send(new PutBucketLoggingCommand({
                Bucket: bucketName,
                BucketLoggingStatus: {
                    LoggingEnabled: {
                        TargetBucket: bucketName,
                        TargetPrefix: "access-logs/"
                    }
                }
            }));
            return {
                action: "ENABLE_LOGGING",
                status: "SUCCESS",
                message: "Access logging enabled (target: same bucket, prefix: access-logs/)",
                before: { logging: 'Disabled' },
                after: { logging: 'Enabled', target: bucketName, prefix: 'access-logs/' }
            };
        } catch (err) {
            return { action: "ENABLE_LOGGING", status: "WARNING", message: `Logging setup requires log delivery permissions: ${err.message}` };
        }
    }
}

module.exports = new ExecutionAgent();
