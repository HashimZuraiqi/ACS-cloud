const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "dummy",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "dummy",
    },
});

const docClient = DynamoDBDocumentClient.from(client);

const connectDB = async () => {
    try {
        // Optional: Check if tables exist or just log connection success
        console.log("DynamoDB Client Initialized");
    } catch (err) {
        console.error("DynamoDB Connection Error", err);
    }
};

module.exports = { docClient, connectDB, client };
