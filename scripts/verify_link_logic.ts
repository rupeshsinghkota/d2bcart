
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSalesAssistantResponse } from '../lib/gemini';

async function verifyLinkHandling() {
    const testCases = [
        {
            name: "Tom & Jerry Case (Screenshot 1)",
            message: "Hi, I need help with this page: https://d2bcart.com/products/tom-jerry-case-200-pcs-lott-price-34-200-6800--343aef96-17e3-4ab3-a2c8-d469a91eed57"
        },
        {
            name: "Sim Ejector Pin (Screenshot 2)",
            message: "Hi, I need help with this page: https://d2bcart.com/products/imported-sim-ejector-pin-100-pcs-patta-price-1-100-100--bd02975c-0cda-4d44-ab5b-646d827b79ec"
        }
    ];

    console.log("=== AI LINK HANDLING VERIFICATION ===\n");

    for (const test of testCases) {
        console.log(`Testing: ${test.name}`);
        console.log(`Input: "${test.message}"`);
        try {
            const response = await getSalesAssistantResponse({
                message: test.message,
                phone: "918000421913"
            });

            console.log(`AI Reasoning: ${response.reasoning}`);
            console.log(`AI Response:`);
            response.messages.forEach((m, i) => console.log(` [${i + 1}] ${m.text}`));
            console.log("-------------------------------------------\n");
        } catch (e) {
            console.error("Analysis failed:", e);
        }
    }
}

verifyLinkHandling().catch(console.error);
