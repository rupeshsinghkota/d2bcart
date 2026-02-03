
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function listModels() {
    try {
        // Note: The SDK doesn't have a direct 'listModels' in the same way as the REST API,
        // but we can try to find what's available or just try different versions.
        // Actually, the most reliable version for v1 is gemini-1.5-flash.

        // Let's try gemini-pro (v1)
        console.log("Checking gemini-pro...");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("test");
        console.log("gemini-pro works!");
    } catch (e: any) {
        console.log("gemini-pro failed:", e.message);
    }

    try {
        console.log("Checking gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        console.log("gemini-1.5-flash works!");
    } catch (e: any) {
        console.log("gemini-1.5-flash failed:", e.message);
    }
}

listModels();
