import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { GoogleGenerativeAI } from "@google/generative-ai";

async function testDeepResearch() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error("No API key found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = "deep-research-pro-preview-12-2025";

    console.log(`\n--- Testing ${modelName} ---`);

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        // Deep research might require grounding or specific tools
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Find 2 wholesalers of mobile covers in Delhi with their phone numbers." }] }],
            tools: [{ googleSearchRetrieval: {} }] as any
        });
        console.log("Success! Response:", result.response.text());
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}

testDeepResearch();
