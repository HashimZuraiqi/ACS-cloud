const { docClient } = require('./src/config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
require('dotenv').config({ path: './.env' });
const { decrypt } = require('./src/utils/encryption');

async function test() {
    const command = new ScanCommand({ TableName: "CloudGuard_Users" });
    const res = await docClient.send(command);
    for (const item of res.Items) {
        if (item.email === "qa_test@example.com") {
            const region = item.awsCredentials?.region;
            console.log("QA User Region in DDB:", region);
        }
    }
}
test();
