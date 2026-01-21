const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ No API Key found");
        return;
    }
    const genAI = new GoogleGenerativeAI(key);

    // We can't easily list models via this SDK helper directly in some versions, 
    // but we can try a direct fetch or try the safest model 'gemini-pro'.

    console.log("Checking common models...");

    const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-002",
        "gemini-1.5-pro",
        "gemini-1.5-pro-001",
        "gemini-1.0-pro-001",
        "gemini-pro"
    ];

    for (const modelName of modelsToTry) {
        try {
            console.log(`\nTesting: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            const response = await result.response;
            console.log(`✅ SUCCESS: ${modelName} works!`);
            console.log(`   Response: ${response.text().substring(0, 20)}`);
            // If one works, we can stop or keep checking
        } catch (error) {
            let msg = error.message || error;
            if (msg.includes('404')) console.log(`❌ 404 Not Found: ${modelName}`);
            else if (msg.includes('429')) console.log(`⚠️ 429 Quota Exceeded: ${modelName}`);
            else console.log(`❌ Error: ${msg}`);
        }
    }
}

listModels();
