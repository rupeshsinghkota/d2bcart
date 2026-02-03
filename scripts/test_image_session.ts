
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function executeMsg91Call(payload: any) {
    const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
    if (!MSG91_AUTH_KEY) return { success: false, error: 'MSG91_AUTH_KEY missing' };

    const endpoint = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';

    try {
        console.log('Sending Payload:', JSON.stringify(payload, null, 2));
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'authkey': MSG91_AUTH_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        return data;
    } catch (e) {
        console.error('Error:', e);
        return { success: false, error: e };
    }
}

async function testImageSession() {
    // HARDCODED TESTING NUMBER - UPDATE IF NEEDED or use process.argv
    const mobile = "918000421913"; // Using the number from simulation
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || "917557777987";

    // Test 1: Content Type 'image' structure
    const payload = {
        integrated_number: integratedNumber,
        recipient_number: mobile,
        content_type: "image",

        attachment_url: "https://via.placeholder.com/300.png",
        caption: "Test Image Session"
    };

    console.log(`Testing Image Session to ${mobile}...`);
    await executeMsg91Call(payload);
}

testImageSession();
