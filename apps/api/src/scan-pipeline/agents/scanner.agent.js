const { S3Client, GetBucketPolicyCommand, GetBucketAclCommand, GetBucketEncryptionCommand, GetPublicAccessBlockCommand, GetBucketLocationCommand } = require("@aws-sdk/client-s3");

class ScannerAgent {
    constructor() {
        this.defaultRegion = process.env.AWS_REGION || "us-east-1";
        this.s3 = new S3Client({ region: this.defaultRegion });
    }

    async scanBucket(bucketName) {
        if (!bucketName) throw new Error("Bucket name is required");

        console.log(`[ScannerAgent] Scanning bucket: ${bucketName}`);

        let s3Client = this.s3;
        let region = this.defaultRegion;

        try {
            // STEP 0: Determine Bucket Region (Dynamic Discovery)
            // This prevents "PermanentRedirect" errors if bucket is in EU/Asia
            try {
                const locationCommand = new GetBucketLocationCommand({ Bucket: bucketName });
                const locationData = await this.s3.send(locationCommand);
                if (locationData.LocationConstraint) {
                    region = locationData.LocationConstraint;
                    if (region === 'EU') region = 'eu-west-1'; // Legacy weirdness handling
                }

                // If region differs from default, use a region-specific client
                if (region !== this.defaultRegion) {
                    console.log(`[ScannerAgent] Bucket is in ${region}. Switching client.`);
                    s3Client = new S3Client({ region: region });
                }
            } catch (err) {
                // If we can't even get location, likely bucket doesn't exist or access denied.
                // We will let the ACL check below catch the specific error to keep error handling unified.
                console.warn(`[ScannerAgent] Could not determine region: ${err.message}. Trying default.`);
            }

            const config = {
                bucket: bucketName,
                scan_time: new Date().toISOString(),
                public_access_block: {},
                policy: null,
                acl: [],
                encryption: "NOT_CONFIGURED",
                region: region
            };

            // STEP 1: Verify Existence & Access (Critical Check)
            try {
                const aclCommand = new GetBucketAclCommand({ Bucket: bucketName });
                const aclData = await s3Client.send(aclCommand);
                config.acl = aclData.Grants || [];
            } catch (err) {
                // FAIL FAST
                console.error(`[ScannerAgent] Critical Validation Error: ${err.message} (${err.name})`);
                if (err.name === 'NoSuchBucket') throw new Error(`Bucket "${bucketName}" not found.`);
                if (err.name === 'AccessDenied') throw new Error(`Access Denied to "${bucketName}". Check permissions.`);
                if (err.name === 'InvalidBucketName') throw new Error(`Bucket name "${bucketName}" is invalid.`);
                throw err;
            }

            // 2. Get Public Access Block
            try {
                const command = new GetPublicAccessBlockCommand({ Bucket: bucketName });
                const response = await s3Client.send(command);
                config.public_access_block = response.PublicAccessBlockConfiguration || {};
            } catch (err) {
                if (err.name === 'NoSuchPublicAccessBlockConfiguration') {
                    config.public_access_block = {}; // Safe default
                } else {
                    console.warn(`[ScannerAgent] Error fetching Public Access Block: ${err.message}`);
                }
            }

            // 3. Get Bucket Policy
            try {
                const command = new GetBucketPolicyCommand({ Bucket: bucketName });
                const response = await s3Client.send(command);
                config.policy = response.Policy ? JSON.parse(response.Policy) : null;
            } catch (err) {
                if (err.name === 'NoSuchBucketPolicy') {
                    config.policy = null;
                } else {
                    console.warn(`[ScannerAgent] Error fetching Policy: ${err.message}`);
                }
            }

            // 4. Get Encryption
            try {
                const command = new GetBucketEncryptionCommand({ Bucket: bucketName });
                const response = await s3Client.send(command);
                config.encryption = response.ServerSideEncryptionConfiguration;
            } catch (err) {
                if (err.name === 'ServerSideEncryptionConfigurationNotFoundError') {
                    config.encryption = "NOT_CONFIGURED";
                } else {
                    console.warn(`[ScannerAgent] Error fetching Encryption: ${err.message}`);
                }
            }

            return config;

        } catch (error) {
            // Propagate validation errors
            console.error(`[ScannerAgent] Scan Pipeline Error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new ScannerAgent();
