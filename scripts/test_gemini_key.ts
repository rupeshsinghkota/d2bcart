const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function verifyGemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ No API Key found in .env.local");
        process.exit(1);
    }
    console.log("🔑 API Key found, calling Gemini 1.5 Flash...");

    const genAI = new GoogleGenerativeAI(key);
    // Changed to 1.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "Explain briefly what 'OnePlus Nord Cover' is.";

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("✅ API Success! Response:");
        console.log(text.substring(0, 100) + "...");
    } catch (error) {
        console.error("❌ API Call Failed:", error);
    }
}

verifyGemini();
