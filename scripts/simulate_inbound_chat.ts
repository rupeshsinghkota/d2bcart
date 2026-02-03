
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function simulateInbound(mobile: string, message: string) {
    console.log(`--- Simulating Inbound Message from ${mobile}: "${message}" ---`)

    const { getSalesAssistantResponse } = await import('../lib/gemini')
    const { sendWhatsAppSessionMessage, sendWhatsAppImageMessage } = await import('../lib/msg91')

    console.log("1. Generating AI Response...")
    try {
        const aiMessages = await getSalesAssistantResponse({ message, phone: mobile });
        console.log("AI Responses:", aiMessages);

        console.log("2. Sending Replies...");

        for (const msg of aiMessages) {
            const cleanText = msg.text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

            if (msg.type === 'image' && msg.imageUrl) {
                console.log(`Sending IMAGE: ${msg.productName} - ${msg.imageUrl.slice(0, 50)}...`);
                const result = await sendWhatsAppImageMessage({
                    mobile: mobile,
                    imageUrl: msg.imageUrl,
                    caption: cleanText
                });
                console.log("MSG91 Result:", result.success ? "✓ Image Sent" : "✗ Failed", result.error || '');
            } else {
                console.log(`Sending TEXT: ${cleanText.substring(0, 50)}...`);
                const result = await sendWhatsAppSessionMessage({
                    mobile: mobile,
                    message: cleanText
                });
                console.log("MSG91 Result:", result.success ? "✓ Text Sent" : "✗ Failed", result.error || '');
            }
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
