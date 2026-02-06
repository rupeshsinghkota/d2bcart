import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { findSuppliers } from '../lib/research_openai';

async function testOpenAIResearch() {
    console.log("🔍 Testing OpenAI Supplier Research...");

    const category = process.argv[2] || "mobile accessories";
    const location = process.argv[3] || "Delhi";

    console.log(`Searching for ${category} in ${location}...`);

    try {
        const result = await findSuppliers(category, location);

        console.log("\n=== Results ===");
        console.log(`Found ${result.suppliers.length} suppliers:`);

        result.suppliers.forEach((s, i) => {
            console.log(`${i + 1}. ${s.name} - ${s.phone} (${s.location})`);
            console.log(`   Description: ${s.description}`);
            console.log(`   Source: ${s.source}\n`);
        });

        if (result.suppliers.length === 0) {
            console.log("⚠️ No suppliers found. Check logs below:");
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

testOpenAIResearch();
