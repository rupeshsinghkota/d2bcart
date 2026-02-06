import { GoogleGenerativeAI } from "@google/generative-ai";

export interface DiscoveredSupplier {
    name: string;
    phone: string | null;
    website: string | null;
    location: string | null;
    description: string;
    source: string;
}

let genAI: GoogleGenerativeAI | null = null;

function getGemini() {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is required");
        }
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

// Helper: Clean phone number to digits only
function cleanPhone(phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^0-9]/g, '');
    // Remove leading 91 or 0 if present
    if (digits.startsWith('91') && digits.length === 12) {
        return digits.substring(2);
    }
    if (digits.startsWith('0') && digits.length === 11) {
        return digits.substring(1);
    }
    return digits;
}

// Helper: Validate Indian phone number
function isValidIndianPhone(phone: string | null): boolean {
    if (!phone) return false;
    const digits = phone.replace(/[^0-9]/g, '');
    // Indian mobile: 10 digits starting with 6-9
    return digits.length === 10 && /^[6-9]/.test(digits);
}

/**
 * Find suppliers using Gemini 2.0 Flash with Google Search grounding
 * This replaces the old DuckDuckGo/Bing scraping approach with a single AI call
 */
export async function findSuppliers(
    category: string,
    location: string = "India"
): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    addLog(`[Research] 🔍 Starting Gemini grounded search for "${category}" in "${location}"...`);

    // Try multiple models in order (some may have more quota)
    // Updated with full model IDs for safer fallback
    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];

    for (const modelName of modelsToTry) {
        try {
            addLog(`[Research] 🤖 Trying model: ${modelName}...`);

            const model = getGemini().getGenerativeModel({
                model: modelName,
                // Enable Google Search grounding (may not work on all models)
                tools: modelName.includes("2.0") ? [{ googleSearchRetrieval: {} }] as any : undefined
            });

            const prompt = `You are a Sourcing Expert specializing in finding WHOLESALERS and MANUFACTURERS in India.

TASK: Find wholesalers and manufacturers for "${category}" in "${location}" with their contact details.

SEARCH FOCUS:
- Look for wholesale markets, B2B suppliers, manufacturers
- Find phone numbers (Indian format: 10 digits starting with 6-9)
- Search IndiaMart, JustDial, TradeIndia, local market directories
- Focus on "${location}" area specifically

IMPORTANT FILTERING:
- ONLY include wholesalers, distributors, and manufacturers
- EXCLUDE: Retail shops, repair centers, service providers, Amazon/Flipkart listings
- EXCLUDE: Generic directory pages without specific vendor info

Return ONLY a JSON object with this exact format:
{
    "suppliers": [
        {
            "name": "Business Name",
            "phone": "9876543210",
            "location": "Market/Area Name",
            "description": "Brief description of what they supply"
        }
    ]
}

If no quality suppliers are found, return: { "suppliers": [] }
Do NOT include any text outside the JSON object.`;

            addLog(`[Research] 🤖 Asking Gemini to search and extract suppliers...`);

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            addLog(`[Research] 📝 Received response (${text.length} chars)`);

            // Check for grounding metadata (if available)
            const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
            if (groundingMetadata?.searchEntryPoint?.renderedContent) {
                addLog(`[Research] 🌐 Grounding sources used: ${groundingMetadata.webSearchQueries?.join(', ') || 'Google Search'}`);
            }

            // Parse JSON from response
            let jsonText = text;

            // Handle markdown code blocks
            if (text.includes("```json")) {
                const match = text.match(/```json\s*([\s\S]*?)\s*```/);
                if (match) jsonText = match[1];
            } else if (text.includes("```")) {
                const match = text.match(/```\s*([\s\S]*?)\s*```/);
                if (match) jsonText = match[1];
            }

            // Clean up any extra text
            jsonText = jsonText.trim();
            if (!jsonText.startsWith("{")) {
                const jsonStart = jsonText.indexOf("{");
                if (jsonStart !== -1) {
                    jsonText = jsonText.substring(jsonStart);
                }
            }
            if (!jsonText.endsWith("}")) {
                const jsonEnd = jsonText.lastIndexOf("}");
                if (jsonEnd !== -1) {
                    jsonText = jsonText.substring(0, jsonEnd + 1);
                }
            }

            const parsed = JSON.parse(jsonText);

            if (!parsed.suppliers || !Array.isArray(parsed.suppliers)) {
                addLog(`[Research] ⚠️ Invalid response format, no suppliers array found`);
                continue; // Try next model if format is bad
            }

            // Process and validate suppliers
            const suppliers: DiscoveredSupplier[] = parsed.suppliers
                .filter((s: any) => s.name && s.phone)
                .map((s: any) => ({
                    name: s.name,
                    phone: cleanPhone(s.phone),
                    website: s.website || null,
                    location: s.location || location,
                    description: s.description || `${category} supplier`,
                    source: `Gemini ${modelName} + Google Search`
                }))
                .filter((s: DiscoveredSupplier) => isValidIndianPhone(s.phone));

            // Deduplicate by phone
            const unique = new Map<string, DiscoveredSupplier>();
            for (const s of suppliers) {
                if (s.phone && !unique.has(s.phone)) {
                    unique.set(s.phone, s);
                }
            }

            const finalSuppliers = Array.from(unique.values()).slice(0, 15);
            addLog(`[Research] ✅ Found ${finalSuppliers.length} unique wholesalers/manufacturers`);

            return { suppliers: finalSuppliers, logs: logs };

        } catch (error) {
            const errMsg = (error as Error).message;
            addLog(`[Research] ❌ Error with ${modelName}: ${errMsg}`);

            // Check for specific errors
            if (errMsg.includes("API_KEY")) {
                addLog(`[Research] 💡 Tip: Set GEMINI_API_KEY in your environment variables`);
                break; // No point trying other models if key is missing
            }
            // If quota error, loop will continue to next model
        }
    }

    addLog(`[Research] ❌ All models failed or reached quota.`);
    return { suppliers: [], logs: logs };
}

export default findSuppliers;
