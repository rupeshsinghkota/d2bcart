
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testChatInitiation() {
    console.log("🚀 Testing Chat Initiation API...");

    const payload = {
        action: 'initiate_chat',
        supplier: {
            name: "Test Supplier",
            phone: "917557777987" // Using the internal test number
        }
    };

    try {
        const response = await fetch('http://localhost:3000/api/debug/sourcing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(data, null, 2));
    } catch (e: any) {
        console.log("Error (expected if server not running):", e.message);
        console.log("Attempting direct library call test...");

        // If server is not running, we test the logic directly
        const { getSourcingAgentResponse } = await import('../lib/sourcing_agent');
        const { sendWhatsAppMessage } = await import('../lib/msg91');

        const aiRes = await getSourcingAgentResponse({
            message: "",
            phone: payload.supplier.phone
        });

        console.log("AI Message:", aiRes.message);

        const waRes = await sendWhatsAppMessage({
            mobile: payload.supplier.phone,
            templateName: 'd2b_ai_response',
            integratedNumber: process.env.SUPPLIER_WA_NUMBER || "917557777987",
            components: {
                body_1: { type: 'text', value: aiRes.message }
            }
        });

        console.log("WhatsApp Result:", JSON.stringify(waRes, null, 2));
    }
}

testChatInitiation();
