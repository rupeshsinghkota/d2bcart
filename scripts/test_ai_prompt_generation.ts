const OpenAI = require("openai");
require('dotenv').config({ path: '.env.local' });

async function verifyPrompt() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        console.error("❌ No API Key found");
        process.exit(1);
    }

    const openai = new OpenAI({ apiKey: key });

    // Exact prompt structure from refineProduct.ts
    const testProductName = "phone cover for iphone 13 shockproof transparent";

    const prompt = `
    You are an E-commerce SEO Expert. Analyze this product title and existing description to generate a better version.
    
    Input Title: "${testProductName}"
    Input Description: "Standard clear case for iphone 13"
    
    Instructions:
    1. **Preserve Information**: Do NOT remove any technical details, specs, or unique info from the Input Description.
    2. **Enhance**: Create a professional, LONG, HTML-formatted description.
       - Use <h2> for section headers like "Key Features", "Specifications", "Why Buy This", "Product Overview".
       - Use <ul><li> for features and specs.
       - Use <p> for paragraphs.
       - NO markdown code blocks (\`\`\`html). Return ONLY the raw HTML string for the description.
    3. **SEO**: Optimize the refined_name and refined_description for better search visibility.
    
    Return a JSON object with strictly these fields:
    "refined_name" (string, SEO optimized, capitalized, professional),
    "refined_description" (string, HTML content with <h2>, <p>, <ul>. DO NOT wrap in \`\`\`html),
    "brand" (string, guess if not explicit),
    "model" (string),
    "type" (string e.g. "Case", "Charger"),
    "keywords" (array of 5 seo strings).
    
    Return ONLY valid JSON.
    `;

    console.log("🤖 Testing Prompt with OpenAI...");

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        console.log("🔍 Raw Response:", content);

        const aiData = JSON.parse(content || '{}')

        console.log('\n--- AI Response ---')
        console.log('Name:', aiData.refined_name)
        console.log('Brand/Model/Type:', aiData.brand, '/', aiData.model, '/', aiData.type)
        console.log('Keywords:', aiData.keywords)
        console.log('\n--- Description HTML (Preview) ---')
        console.log(aiData.refined_description.substring(0, 500) + '...')

        console.log('\n--- Full Raw Description for Verification ---')
        console.log(aiData.refined_description)
    } catch (error: any) {
        console.error("❌ Error:", error);
    }
}

verifyPrompt();
