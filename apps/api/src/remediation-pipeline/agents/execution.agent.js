const {
    S3Client,
    PutPublicAccessBlockCommand,
    GetBucketLocationCommand,
    PutBucketAclCommand,
    GetBucketPolicyCommand,
    PutBucketPolicyCommand,
    DeleteBucketPolicyCommand,
    PutBucketEncryptionCommand,
    PutBucketVersioningCommand,
    PutBucketLoggingCommand
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

    async executePlan(plan, bucketName, credentials) {
        console.log(`[ExecutionAgent] Executing ${plan.steps.length} step(s) for ${bucketName}`);

        const { s3Client } = await this._getClientForBucket(bucketName, credentials);
        const results = [];

        for (const step of plan.steps) {
            try {
                const result = await this._executeStep(step, bucketName, s3Client);
                results.push(result);
                console.log(`[ExecutionAgent] ✓ ${step.action}: ${result.status}`);
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

    // --- Individual remediation actions (all idempotent) ---

    async _blockPublicAccess(bucketName, s3Client) {
        await s3Client.send(new PutPublicAccessBlockCommand({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                IgnorePublicAcls: true,
                BlockPublicPolicy: true,
                RestrictPublicBuckets: true
            }
        }));
        return { action: "PUT_PUBLIC_ACCESS_BLOCK", status: "SUCCESS", message: "Block Public Access enabled" };
    }

    async _removePublicAcls(bucketName, s3Client) {
        await s3Client.send(new PutBucketAclCommand({
            Bucket: bucketName,
            ACL: "private"
        }));
        return { action: "REMOVE_PUBLIC_ACLS", status: "SUCCESS", message: "Bucket ACL set to private" };
    }

    async _sanitizeBucketPolicy(bucketName, s3Client) {
        try {
            const policyResponse = await s3Client.send(new GetBucketPolicyCommand({ Bucket: bucketName }));
            const policy = JSON.parse(policyResponse.Policy);

            // Filter out statements with wildcard principals that Allow access
            const originalCount = policy.Statement.length;
            policy.Statement = policy.Statement.filter(stmt => {
                const principal = JSON.stringify(stmt.Principal || "");
                const isWildcard = principal === '"*"' || principal.includes('"*"');
                const isAllow = stmt.Effect === "Allow";
                return !(isWildcard && isAllow);
            });

            if (policy.Statement.length === 0) {
                // All statements were public — delete the entire policy
                await s3Client.send(new DeleteBucketPolicyCommand({ Bucket: bucketName }));
                return { action: "SANITIZE_BUCKET_POLICY", status: "SUCCESS", message: `Deleted bucket policy (all ${originalCount} statements had wildcard principals)` };
            } else if (policy.Statement.length < originalCount) {
                // Some statements removed
                await s3Client.send(new PutBucketPolicyCommand({
                    Bucket: bucketName,
                    Policy: JSON.stringify(policy)
                }));
                return { action: "SANITIZE_BUCKET_POLICY", status: "SUCCESS", message: `Removed ${originalCount - policy.Statement.length} public statement(s) from policy` };
            } else {
                return { action: "SANITIZE_BUCKET_POLICY", status: "SUCCESS", message: "No wildcard principals found in policy" };
            }
        } catch (err) {
            if (err.name === "NoSuchBucketPolicy") {
                return { action: "SANITIZE_BUCKET_POLICY", status: "SUCCESS", message: "No bucket policy exists (already clean)" };
            }
            throw err;
        }
    }

    async _enableEncryption(bucketName, s3Client) {
        await s3Client.send(new PutBucketEncryptionCommand({
            Bucket: bucketName,
            ServerSideEncryptionConfiguration: {
                Rules: [{
                    ApplyServerSideEncryptionByDefault: {
                        SSEAlgorithm: "AES256"
                    },
                    BucketKeyEnabled: true
                }]
            }
        }));
        return { action: "ENABLE_ENCRYPTION", status: "SUCCESS", message: "SSE-S3 (AES256) encryption enabled" };
    }

    async _enableVersioning(bucketName, s3Client) {
        await s3Client.send(new PutBucketVersioningCommand({
            Bucket: bucketName,
            VersioningConfiguration: {
                Status: "Enabled"
            }
        }));
        return { action: "ENABLE_VERSIONING", status: "SUCCESS", message: "Bucket versioning enabled" };
    }

    async _enableLogging(bucketName, s3Client) {
        // Enable logging to the same bucket with a "logs/" prefix
        // In production, you'd log to a dedicated logging bucket
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
            return { action: "ENABLE_LOGGING", status: "SUCCESS", message: "Access logging enabled (target: same bucket, prefix: access-logs/)" };
        } catch (err) {
            // Logging to self requires certain permissions; provide helpful message
            return { action: "ENABLE_LOGGING", status: "WARNING", message: `Logging setup requires log delivery permissions: ${err.message}` };
        }
    }
}

module.exports = new ExecutionAgent();
