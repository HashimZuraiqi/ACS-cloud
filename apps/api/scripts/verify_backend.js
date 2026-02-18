const SCAN_URL = 'http://localhost:4000/api/scan';
const REM_URL = 'http://localhost:4000/api/remediate/approve';

async function testBackend() {
    try {
        console.log("1. Starting Scan...");
        const scanRes = await fetch(SCAN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucketName: 'cloudguard-trap-hashim' })
        });

        if (!scanRes.ok) throw new Error(`Scan Failed: ${scanRes.status} ${scanRes.statusText}`);

        const scanData = await scanRes.json();
        const scanId = scanData.scan_id;
        console.log(`Scan Created: ${scanId}`);

        console.log("2. Attempting Remediation...");
        const remRes = await fetch(REM_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scanId })
        });

        if (!remRes.ok) {
            const errBody = await remRes.text();
            throw new Error(`Remediation Failed: ${remRes.status} ${remRes.statusText} - ${errBody}`);
        }

        const remData = await remRes.json();
        console.log("Remediation Response:", remData);

    } catch (err) {
        console.error("Test Failed:", err.message);
    }
}

testBackend();
