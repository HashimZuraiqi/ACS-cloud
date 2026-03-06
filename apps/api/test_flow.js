const axios = require('axios');
const API_URL = 'http://localhost:4000/api';
require('dotenv').config({ path: './.env' });

async function runTest() {
    try {
        console.log("1. Registering test user...");
        const email = `testuser_${Date.now()}@example.com`;
        const pw = "password123";
        const signupRes = await axios.post(`${API_URL}/auth/signup`, { name: "Test User", email, password: pw, role: "user" });
        const token = signupRes.data.token;
        console.log("Registered! Token:", token.substring(0, 15) + "...");

        const client = axios.create({
            baseURL: API_URL,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("2. Attempting scan WITHOUT credentials...");
        try {
            await client.post('/ec2-scan', { instanceId: null });
            console.log("X Scan succeeded without credentials! (THIS IS A BUG)");
        } catch (err) {
            console.log("✓ Scan blocked appropriately:", err.response?.status, err.response?.data?.error);
        }

        console.log("3. Saving AWS Credentials...");
        const awsCreds = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || "us-east-1"
        };
        const putCredsRes = await client.put('/auth/aws-credentials', awsCreds);
        console.log("✓ Saved credentials:", putCredsRes.data.message);

        console.log("4. Attempting scan WITH credentials...");
        try {
            const scanRes = await client.post('/ec2-scan', { instanceId: null });
            console.log("✓ Scan succeeded! Results:", scanRes.data?.total_scanned ?? "0");
        } catch (err) {
            console.log("X Scan failed:", err.response?.data || err.message);
        }

    } catch (err) {
        console.error("Test blocked with fatal error:", err.response?.data || err.message);
    }
}
runTest();
