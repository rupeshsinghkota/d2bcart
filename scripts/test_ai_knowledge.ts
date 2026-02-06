import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import OpenAI from 'openai';

async function testAiKnowledge() {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log("Testing AI Native Knowledge of Suppliers...");

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a Sourcing Expert. Provide a list of 5 well-known mobile accessories wholesalers or manufacturers specifically in Delhi, India. Include their phone numbers if you know them. Return as JSON: { \"suppliers\": [ { \"name\": \"...\", \"phone\": \"...\", \"description\": \"...\" } ] }"
                },
                { role: "user", content: "Mobile accessories wholesalers in Delhi" }
            ],
            response_format: { type: "json_object" }
        });

        console.log("Success! Response:", response.choices[0].message.content);
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}

testAiKnowledge();
