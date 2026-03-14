const {
    S3Client,
    GetBucketPolicyCommand,
    GetBucketAclCommand,
    GetBucketEncryptionCommand,
    GetPublicAccessBlockCommand,
    GetBucketLocationCommand,
    ListBucketsCommand,
    GetBucketVersioningCommand,
    GetBucketLoggingCommand,
    GetBucketLifecycleConfigurationCommand,
    GetBucketCorsCommand,
} = require("@aws-sdk/client-s3");

class ScannerAgent {
    async scanBuckets(credentials, specificBucketName = null) {
        if (!credentials) throw new Error("AWS Credentials are required");

        const defaultRegion = "us-east-1"; // Base region for discovery
        const clientConfig = {
            region: defaultRegion,
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        };

        const baseClient = new S3Client(clientConfig);
        let bucketsToScan = [];

        if (specificBucketName) {
            bucketsToScan.push(specificBucketName);
        } else {
            // Discover all buckets
            try {
                console.log("[ScannerAgent] Discovering all buckets...");
                const response = await baseClient.send(new ListBucketsCommand({}));
                bucketsToScan = (response.Buckets || []).map(b => b.Name);
                console.log(`[ScannerAgent] Found ${bucketsToScan.length} buckets.`);
            } catch (error) {
                console.error("[ScannerAgent] Failed to list buckets:", error.message);
                throw new Error("Could not discover buckets. Check your IAM permissions (s3:ListAllMyBuckets).");
            }
        }

        const runConfigs = [];

        for (const bucketName of bucketsToScan) {
            console.log(`[ScannerAgent] Scanning bucket: ${bucketName}`);
            let s3Client = baseClient;
            let region = defaultRegion;

            try {
                // STEP 0: Determine Bucket Region (Dynamic Discovery)
                try {
                    const locationCommand = new GetBucketLocationCommand({ Bucket: bucketName });
                    const locationData = await baseClient.send(locationCommand);
                    if (locationData.LocationConstraint) {
                        region = locationData.LocationConstraint;
                        if (region === 'EU') region = 'eu-west-1'; // Legacy weirdness handling
                    }

                    // If region differs from default, use a region-specific client
                    if (region !== defaultRegion) {
                        console.log(`[ScannerAgent] Bucket ${bucketName} is in ${region}. Switching client.`);
                        s3Client = new S3Client({ ...clientConfig, region: region });
                    }
                } catch (err) {
                    console.warn(`[ScannerAgent] Could not determine region for ${bucketName}: ${err.message}. Trying default.`);
                }

                const config = {
                    bucket: bucketName,
                    scan_time: new Date().toISOString(),
                    public_access_block: {},
                    policy: null,
                    acl: [],
                    encryption: "NOT_CONFIGURED",
                    versioning: null,
                    logging: null,
                    lifecycle: null,
                    cors: null,
                    region: region
                };

                // STEP 1: Verify Existence & Access
                try {
                    const aclCommand = new GetBucketAclCommand({ Bucket: bucketName });
                    const aclData = await s3Client.send(aclCommand);
                    config.acl = aclData.Grants || [];
                } catch (err) {
                    console.error(`[ScannerAgent] Access Error on ${bucketName}: ${err.message}`);
                    continue; // Skip standard errors to continue scanning other buckets
                }

                // 2. Get Public Access Block
                try {
                    const command = new GetPublicAccessBlockCommand({ Bucket: bucketName });
                    const response = await s3Client.send(command);
                    config.public_access_block = response.PublicAccessBlockConfiguration || {};
                } catch (err) {
                    if (err.name !== 'NoSuchPublicAccessBlockConfiguration') {
                        console.warn(`[ScannerAgent] Error fetching Public Access Block for ${bucketName}: ${err.message}`);
                    }
                    config.public_access_block = {};
                }

                // 3. Get Bucket Policy
                try {
                    const command = new GetBucketPolicyCommand({ Bucket: bucketName });
                    const response = await s3Client.send(command);
                    config.policy = response.Policy ? JSON.parse(response.Policy) : null;
                } catch (err) {
                    if (err.name !== 'NoSuchBucketPolicy') {
                        console.warn(`[ScannerAgent] Error fetching Policy for ${bucketName}: ${err.message}`);
                    }
                    config.policy = null;
                }

                // 4. Get Encryption
                try {
                    const command = new GetBucketEncryptionCommand({ Bucket: bucketName });
                    const response = await s3Client.send(command);
                    config.encryption = response.ServerSideEncryptionConfiguration;
                } catch (err) {
                    if (err.name !== 'ServerSideEncryptionConfigurationNotFoundError') {
                        console.warn(`[ScannerAgent] Error fetching Encryption for ${bucketName}: ${err.message}`);
                    }
                    config.encryption = "NOT_CONFIGURED";
                }

                // 5. Get Versioning Status
                try {
                    const command = new GetBucketVersioningCommand({ Bucket: bucketName });
                    const response = await s3Client.send(command);
                    config.versioning = { Status: response.Status || 'Disabled', MFADelete: response.MFADelete || 'Disabled' };
                } catch (err) {
                    console.warn(`[ScannerAgent] Error fetching Versioning for ${bucketName}: ${err.message}`);
                    config.versioning = { Status: 'Disabled' };
                }

                // 6. Get Access Logging
                try {
                    const command = new GetBucketLoggingCommand({ Bucket: bucketName });
                    const response = await s3Client.send(command);
                    config.logging = response.LoggingEnabled ? { LoggingEnabled: true, TargetBucket: response.LoggingEnabled.TargetBucket, TargetPrefix: response.LoggingEnabled.TargetPrefix } : { LoggingEnabled: false };
                } catch (err) {
                    console.warn(`[ScannerAgent] Error fetching Logging for ${bucketName}: ${err.message}`);
                    config.logging = { LoggingEnabled: false };
                }

                // 7. Get Lifecycle Configuration
                try {
                    const command = new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName });
                    const response = await s3Client.send(command);
                    config.lifecycle = { Rules: (response.Rules || []).map(r => ({ ID: r.ID, Status: r.Status, Prefix: r.Prefix || r.Filter?.Prefix })) };
                } catch (err) {
                    if (err.name !== 'NoSuchLifecycleConfiguration') {
                        console.warn(`[ScannerAgent] Error fetching Lifecycle for ${bucketName}: ${err.message}`);
                    }
                    config.lifecycle = { Rules: [] };
                }

                // 8. Get CORS Configuration
                try {
                    const command = new GetBucketCorsCommand({ Bucket: bucketName });
                    const response = await s3Client.send(command);
                    config.cors = (response.CORSRules || []).map(r => ({ AllowedOrigins: r.AllowedOrigins, AllowedMethods: r.AllowedMethods, AllowedHeaders: r.AllowedHeaders }));
                } catch (err) {
                    if (err.name !== 'NoSuchCORSConfiguration') {
                        console.warn(`[ScannerAgent] Error fetching CORS for ${bucketName}: ${err.message}`);
                    }
                    config.cors = null;
                }

                runConfigs.push(config);

            } catch (error) {
                console.error(`[ScannerAgent] Error processing bucket ${bucketName}: ${error.message}`);
            }
        }

        return runConfigs;
    }
}

module.exports = new ScannerAgent();
