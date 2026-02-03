
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function simulateInbound(mobile: string, message: string) {
    console.log(`--- Simulating Inbound Message from ${mobile}: "${message}" ---`)

    // We call the local API route (Assumes 'npm run dev' is NOT needed if we just mock the function call logic,
    // but better to mock the FETCH call to the local server if running, or just run the logic directly.)

    // For simplicity, let's trigger the logic that would be in the route
    const { getSalesAssistantResponse } = await import('../lib/gemini')
    const { sendWhatsAppSessionMessage } = await import('../lib/msg91')

    console.log("1. Generating AI Response...")
    try {
        const aiMessages = await getSalesAssistantResponse({ message, phone: mobile });
        console.log("AI Responses:", aiMessages);

        console.log("2. Sending Replies via Template...");
        const { sendWhatsAppMessage } = await import('../lib/msg91');

        for (const msg of aiMessages) {
            const cleanMsg = msg.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            console.log(`Sending: ${cleanMsg.substring(0, 50)}...`);
            const result = await sendWhatsAppMessage({
                mobile: mobile,
                templateName: 'd2b_ai_response',
                components: {
                    body_1: { type: 'text', value: cleanMsg }
                }
            });
            console.log("MSG91 Result:", result.success ? "✓ Sent" : "✗ Failed");
        }
    } catch (e) {
        console.error("Simulation Failed:", e);
    }
}

// Test Run
const testMobile = "918000421913"
const testQuery = "Redmi cases"

simulateInbound(testMobile, testQuery).then(() => {
    console.log("Simulation Finished.");
});
