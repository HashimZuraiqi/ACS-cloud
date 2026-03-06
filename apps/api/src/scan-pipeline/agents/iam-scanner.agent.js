const {
    IAMClient,
    ListUsersCommand,
    ListAttachedUserPoliciesCommand,
    ListUserPoliciesCommand,
    GetAccessKeyLastUsedCommand,
    ListAccessKeysCommand,
} = require("@aws-sdk/client-iam");

class IAMScannerAgent {

    /**
     * Scan a single IAM user by their username.
     * Gathers security-relevant configuration data like policies and last activity.
     */
    async scanUser(username, credentials) {
        if (!username) throw new Error("Username is required");
        if (!credentials) throw new Error("AWS Credentials are required");

        console.log(`[IAMScannerAgent] Scanning user: ${username}`);

        const region = "us-east-1"; // IAM is a global service -> always map to us-east-1
        const clientConfig = {
            region: region,
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        };
        const iamClient = new IAMClient(clientConfig);

        try {
            const config = {
                username,
                scan_time: new Date().toISOString(),
                has_admin_access: false,
                password_last_used: null,
                access_key_last_used: null,
                attached_policies: [],
                inline_policies: [],
            };

            // 1. Get Attached Policies
            try {
                const attachedCommand = new ListAttachedUserPoliciesCommand({ UserName: username });
                const attachedResponse = await iamClient.send(attachedCommand);
                config.attached_policies = (attachedResponse.AttachedPolicies || []).map(p => ({
                    policy_name: p.PolicyName,
                    policy_arn: p.PolicyArn,
                }));
                if (config.attached_policies.some(p => p.policy_name === "AdministratorAccess")) {
                    config.has_admin_access = true;
                }
            } catch (err) {
                console.warn(`[IAMScannerAgent] Error fetching attached policies for ${username}: ${err.message}`);
                // If we get an error getting the user's policies, we likely have an issue reading them (like they don't exist)
                if (err.name === 'NoSuchEntityException') {
                    throw new Error(`User "${username}" not found.`);
                }
            }

            // 2. Get Inline Policies
            try {
                const inlineCommand = new ListUserPoliciesCommand({ UserName: username });
                const inlineResponse = await iamClient.send(inlineCommand);
                config.inline_policies = inlineResponse.PolicyNames || [];
                // Simple string match check, a real scanner would need to parse the policy document
                if (config.inline_policies.some(p => p.toLowerCase().includes("admin"))) {
                    // For our purposes, we just flag the direct managed policy. 
                }
            } catch (err) {
                console.warn(`[IAMScannerAgent] Error fetching inline policies for ${username}: ${err.message}`);
            }

            // 3. To get PasswordLastUsed, we'd normally use GetUser or GetCredentialReport. 
            // For MVP, we will try to handle this if possible (often needs extra permissions)
            // But let's check Access Keys which we can do directly.

            // 4. Get Access Key Last Used
            try {
                const keysCommand = new ListAccessKeysCommand({ UserName: username });
                const keysResponse = await iamClient.send(keysCommand);

                let mostRecentKeyUsage = null;
                for (const key of (keysResponse.AccessKeyMetadata || [])) {
                    try {
                        const lastUsedCommand = new GetAccessKeyLastUsedCommand({ AccessKeyId: key.AccessKeyId });
                        const lastUsedResponse = await iamClient.send(lastUsedCommand);

                        const lastUsedDate = lastUsedResponse.AccessKeyLastUsed?.LastUsedDate;
                        if (lastUsedDate) {
                            if (!mostRecentKeyUsage || new Date(lastUsedDate) > new Date(mostRecentKeyUsage)) {
                                mostRecentKeyUsage = lastUsedDate;
                            }
                        }
                    } catch (err) {
                        console.warn(`[IAMScannerAgent] Error fetching last used for key ${key.AccessKeyId}: ${err.message}`);
                    }
                }
                config.access_key_last_used = mostRecentKeyUsage ? mostRecentKeyUsage.toISOString() : null;
            } catch (err) {
                console.warn(`[IAMScannerAgent] Error fetching access keys for ${username}: ${err.message}`);
            }

            return config;
        } catch (error) {
            console.error(`[IAMScannerAgent] Scan Pipeline Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Scan all IAM users.
     */
    async scanAllUsers(credentials) {
        if (!credentials) throw new Error("AWS Credentials are required");
        console.log(`[IAMScannerAgent] Scanning all IAM users...`);

        const region = "us-east-1"; // IAM is a global service
        const clientConfig = {
            region: region,
            credentials: {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey
            }
        };
        const iamClient = new IAMClient(clientConfig);

        try {
            const command = new ListUsersCommand({});
            const response = await iamClient.send(command);

            const users = response.Users || [];

            if (users.length === 0) {
                console.log("[IAMScannerAgent] No users found.");
                return [];
            }

            console.log(`[IAMScannerAgent] Found ${users.length} user(s). Scanning each...`);

            const results = [];
            for (const user of users) {
                try {
                    const config = await this.scanUser(user.UserName, credentials);

                    // Add password last used from the list users response
                    config.password_last_used = user.PasswordLastUsed ? user.PasswordLastUsed.toISOString() : null;

                    results.push(config);
                } catch (err) {
                    console.warn(`[IAMScannerAgent] Failed to scan ${user.UserName}: ${err.message}`);
                    results.push({ username: user.UserName, error: err.message });
                }
            }

            return results;

        } catch (error) {
            console.error(`[IAMScannerAgent] Error listing users: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new IAMScannerAgent();
