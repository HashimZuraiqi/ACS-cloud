const { EC2Client, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");
require('dotenv').config({ path: './.env' });

async function test() {
    const region = "us-east-1";
    console.log("process.env.AWS_REGION is:", process.env.AWS_REGION);

    const clientConfig = {
        region: region,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    };

    console.log("Client config:", JSON.stringify(clientConfig, null, 2));

    try {
        const ec2Client = new EC2Client(clientConfig);
        const command = new DescribeInstancesCommand({
            Filters: [{ Name: "instance-state-name", Values: ["running"] }]
        });
        const response = await ec2Client.send(command);
        console.log("Success! Found", response.Reservations?.length || 0, "reservations.");
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
