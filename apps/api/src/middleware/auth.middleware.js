const jwt = require('jsonwebtoken');
const { docClient } = require('../config/db');
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { decrypt } = require('../utils/encryption');

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_for_dev";
const TABLE_NAME = "CloudGuard_Users";

/**
 * Middleware to verify JWT and attach user info (including decrypted AWS credentials) to the request.
 */
const verifyToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "No token provided. Authentication required." });
    }

    try {
        // 1. Verify JWT signature
        const decoded = jwt.verify(token, JWT_SECRET);

        // 2. Fetch user record from DynamoDB to get AWS Credentials
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { email: decoded.email }
        });

        const response = await docClient.send(command);
        const user = response.Item;

        if (!user) {
            return res.status(401).json({ error: "User no longer exists." });
        }

        // 3. Attach standard user info
        req.user = {
            email: user.email,
            role: user.role,
            fullName: user.fullName
        };

        // 4. Attach decrypted AWS credentials if they exist
        if (user.awsCredentials) {
            req.user.awsCredentials = {
                accessKeyId: decrypt(user.awsCredentials.accessKeyId),
                secretAccessKey: decrypt(user.awsCredentials.secretAccessKey),
                region: user.awsCredentials.region // region doesn't need encryption, but we can structure it here
            };
        } else {
            req.user.awsCredentials = null;
        }

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Token expired. Please log in again." });
        }
        console.error("[Auth Middleware]", err);
        return res.status(403).json({ error: "Failed to authenticate token" });
    }
};

module.exports = {
    verifyToken
};
