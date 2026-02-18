const { S3Client, PutPublicAccessBlockCommand, GetBucketLocationCommand } = require("@aws-sdk/client-s3");

class ExecutionAgent {
    constructor() {
        this.defaultRegion = process.env.AWS_REGION || "us-east-1";
        this.s3 = new S3Client({ region: this.defaultRegion });
    }

    async executePlan(plan, bucketName) {
        console.log(`[ExecutionAgent] Executing plan for ${bucketName}`);

        const results = [];
        let s3Client = this.s3;
        let region = this.defaultRegion;

        try {
            // STEP 0: Determine Bucket Region (Dynamic Discovery)
            try {
                const locationCommand = new GetBucketLocationCommand({ Bucket: bucketName });
                const locationData = await this.s3.send(locationCommand);
                if (locationData.LocationConstraint) {
                    region = locationData.LocationConstraint;
                    if (region === 'EU') region = 'eu-west-1'; // Legacy weirdness handling
                }

                // If region differs from default, use a region-specific client
                if (region !== this.defaultRegion) {
                    console.log(`[ExecutionAgent] Bucket is in ${region}. Switching client.`);
                    s3Client = new S3Client({ region: region });
                }
            } catch (err) {
                console.warn(`[ExecutionAgent] Could not determine region: ${err.message}. Trying default.`);
            }

            for (const step of plan.steps) {
                try {
                    if (step.action === "PUT_PUBLIC_ACCESS_BLOCK") {
                        const command = new PutPublicAccessBlockCommand({
                            Bucket: bucketName,
                            PublicAccessBlockConfiguration: {
                                BlockPublicAcls: true,
                                IgnorePublicAcls: true,
                                BlockPublicPolicy: true,
                                RestrictPublicBuckets: true
                            }
                        });

                        await s3Client.send(command);
                        results.push({ action: step.action, status: "SUCCESS" });
                        console.log(`[ExecutionAgent] Applied Block Public Access to ${bucketName} in ${region}`);
                    }
                    // Add more action handlers here
                } catch (error) {
                    console.error(`[ExecutionAgent] Failed to execute ${step.action}: ${error.message}`);
                    results.push({ action: step.action, status: "FAILED", error: error.message });
                }
            }

            return results;
        } catch (error) {
            console.error(`[ExecutionAgent] Fatal Error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new ExecutionAgent();
