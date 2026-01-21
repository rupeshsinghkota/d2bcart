const OpenAI = require("openai");
require('dotenv').config({ path: '.env.local' });

async function verifyOpenAI() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        console.error("❌ No API Key found in .env.local");
        process.exit(1);
    }
    console.log("🔑 API Key found, calling OpenAI...");

    const openai = new OpenAI({ apiKey: key });

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: "Say hello!" }],
            model: "gpt-3.5-turbo",
        });

        console.log("✅ API Success! Response:");
        console.log(completion.choices[0].message.content);
    } catch (error) {
        console.error("❌ API Call Failed:", error);
    }
}

verifyOpenAI();
