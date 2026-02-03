
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function simulateInbound(mobile: string, message: string) {
    console.log(`--- Simulating Inbound Message from ${mobile}: "${message}" ---`)

    const { getSalesAssistantResponse } = await import('../lib/gemini')
    const { sendWhatsAppSessionMessage } = await import('../lib/msg91')

    console.log("1. Generating AI Response...")
    try {
        const aiMessages = await getSalesAssistantResponse({ message, phone: mobile });
        console.log("AI Responses:", JSON.stringify(aiMessages, null, 2));

        console.log("2. Sending Replies (Matched to Production Webhook)...");

        for (const msg of aiMessages) {
            // Production logic: Always use text session message
            const cleanText = msg.text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
            console.log(`Sending: ${cleanText.substring(0, 50)}...`);

            const result = await sendWhatsAppSessionMessage({
                mobile: mobile,
                message: cleanText
            });
            console.log("MSG91 Result:", result.success ? "✓ Sent" : "✗ Failed", result.error || '');
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
