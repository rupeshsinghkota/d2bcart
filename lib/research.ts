import OpenAI from 'openai';

// Helper to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface DiscoveredSupplier {
    name: string;
    phone: string | null;
    website: string | null;
    location: string | null;
    description: string;
    source: string;
}

let openai: OpenAI | null = null;
function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

async function generateSearchQueries(category: string, location: string, addLog: (msg: string) => void): Promise<string[]> {
    addLog(`[Research] 🤖 Asking AI to generate best search queries for "${category}" in "${location}"...`);
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a Sourcing Expert in India. Generate 3 specific DuckDuckGo search queries to find WHOLESALERS or MANUFACTURERS for the given category and location.
                    Focus on finding phone numbers. Use terms like "Gaffar Market", "Wholesale Market", "Contact Number", "Manufacturer".
                    
                    Return a JSON object with a single key "queries" containing an array of strings.
                    Example: { "queries": ["Mobile Covers wholesaler Karol Bagh contact", "Gaffar Market mobile accessories list"] }`
                },
                { role: "user", content: `Category: ${category}, Location: ${location}` }
            ],
            response_format: { type: "json_object" } // Using json object based on previous patterns but prompt asks for array. 
            // Actually gpt-4o-mini supports structured outputs or we can just ask for a JSON object with a key 'queries'
        });

        // Better to ask for an object
        const content = response.choices[0].message.content || "{}";
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            // fallback
            return [
                `Top wholesalers for ${category} in ${location} contact number`,
                `${category} supplier phone number ${location}`
            ];
        }

        // If the checking model returns { "queries": [...] } or just the array if we prompted right.
        // Let's refine the prompt in the next step or handle both.
        // For safety/speed, I will update the prompt above to return { "queries": [...] }

        let queries = [];
        if (Array.isArray(parsed)) queries = parsed;
        else if (parsed.queries && Array.isArray(parsed.queries)) queries = parsed.queries;
        else queries = [
            `Top wholesalers for ${category} in ${location} contact number`,
            `${category} manufacturer ${location} contact`
        ];

        addLog(`[Research] 🤖 AI suggested: ${queries.join(", ")}`);
        return queries;

    } catch (e) {
        addLog(`[Research] AI Query Generation Failed: ${(e as Error).message}. Using fallback.`);
        return [
            `Top wholesalers for ${category} in ${location} contact number`,
            `${category} wholesale market ${location} phone number`
        ];
    }
}

export async function findSuppliers(category: string, location: string = "India"): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    addLog(`[Research] Searching for suppliers in category (Free Mode): ${category} in ${location}`);
    const results: DiscoveredSupplier[] = [];

    try {
        // 1. Generate Queries via AI
        // We need to update the prompt inside the function above to ensure valid JSON object response.
        const queries = await generateSearchQueries(category, location, addLog);

        for (const q of queries) {
            const delay = Math.floor(Math.random() * 2000) + 1000;
            await sleep(delay);

            // 1. Try DuckDuckGo Lite
            let html = await safeFetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, 'https://lite.duckduckgo.com/');
            let source = "DuckDuckGo Lite";

            if (!html || html.length < 1000 || html.includes('If this persists')) {
                addLog(`[Research] DDG Blocked/Empty. Switching to Bing for query: "${q}"`);

                // 2. Failover to Bing
                await sleep(1000); // Wait a bit before hitting Bing
                html = await safeFetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, 'https://www.bing.com/');
                source = "Bing Search";

                if (!html || html.length < 2000) {
                    addLog(`[Research] Bing also potentially blocked/empty for query: "${q}"`);
                    continue; // Skip if both fail
                }
            }

            addLog(`[Research] Parsing results from ${source} (Length: ${html.length})`);
            const found = extractSuppliersFromHtml(html, category, location, source);
            addLog(`[Research] found ${found.length} contacts in this step.`);
            results.push(...found);
        }

        // De-duplicate
        const unique = new Map();
        for (const item of results) {
            if (!unique.has(item.phone)) {
                unique.set(item.phone, item);
            }
        }

        const finalResults = Array.from(unique.values()).slice(0, 15);
        addLog(`[Research] Total ${finalResults.length} unique suppliers found.`);
        return { suppliers: finalResults, logs };

    } catch (error) {
        addLog(`[Research] Critical Error: ${(error as Error).message}`);
        return { suppliers: [], logs };
    }
}
