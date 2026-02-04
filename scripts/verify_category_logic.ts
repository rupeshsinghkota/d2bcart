
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSalesAssistantResponse } from '../lib/gemini';

async function verifyCategoryLogic() {
    console.log("=== CATEGORY AWARENESS TEST ===\n");

    const testQueries = [
        "Mobile accessories",
        "Covers",
        "iPhone 15 Case"
    ];

    for (const query of testQueries) {
        console.log(`\n--- Test Query: "${query}" ---`);
        const response = await getSalesAssistantResponse({
            message: query,
            phone: "919155149597"
        });

        console.log("Reasoning:", response.reasoning);
        console.log("Messages:");
        response.messages.forEach((msg, i) => {
            console.log(`  [${i + 1}] ${msg.type.toUpperCase()}: ${msg.type === 'text' ? msg.text : msg.productName}`);
            if (msg.type === 'image') {
                console.log(`      Text included: "${msg.text}"`);
            }
        });

        if (query === "Mobile accessories" || query === "Covers") {
            const hasImages = response.messages.some(m => m.type === 'image');
            if (hasImages) {
                console.error("❌ FAILURE: Broad query resulted in image spam.");
            } else {
                console.log("✅ SUCCESS: Broad query correctly addressed with text/links only.");
            }
        } else if (query === "iPhone 15 Case") {
            const hasImages = response.messages.some(m => m.type === 'image');
            if (hasImages) {
                console.log("✅ SUCCESS: Specific query correctly resulted in product images.");
            } else {
                console.warn("⚠️ WARNING: Specific query yielded no images (check search availability).");
            }
        }
    }
}

verifyCategoryLogic().catch(console.error);
