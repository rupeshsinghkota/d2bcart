
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
        const aiResponse = await getSalesAssistantResponse({ message });
        console.log("AI Response:", aiResponse);

        console.log("2. Sending Reply via Template...");
        const { sendWhatsAppMessage } = await import('../lib/msg91');
        const result = await sendWhatsAppMessage({
            mobile: mobile,
            templateName: 'd2b_ai_response',
            components: {
                body_1: { type: 'text', value: aiResponse }
            }
        });

        console.log("MSG91 Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Simulation Failed:", e);
    }
}

// Test Run
const testMobile = "918000421913"
const testQuery = "Do you have mobile cases for Realme 12 Pro?"

simulateInbound(testMobile, testQuery).then(() => {
    console.log("Simulation Finished.");
});
