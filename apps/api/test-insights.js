const controller = require('./src/advanced-security/advanced-security.controller');

async function testInsights() {
    const req = { user: { email: 'test@example.com' } };
    const res = {
        json: (val) => console.log('SUCCESS API Response Keys:', Object.keys(val)),
        status: (code) => {
            return { 
                json: (val) => console.log(`STATUS ${code} ERROR:`, val) 
            };
        }
    };
    
    console.log("Calling getSecurityInsights...");
    await controller.getSecurityInsights(req, res);
}

testInsights().catch(console.error);
