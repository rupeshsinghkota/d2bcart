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
            try {
                // Use LITE version which is often less blocked
                // Query param is 'q'
                const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`;

                // Random delay between 2s and 5s
                const delay = Math.floor(Math.random() * 3000) + 2000;
                addLog(`[Research] Waiting ${delay}ms before next query...`);
                await sleep(delay);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': 'https://lite.duckduckgo.com/',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    cache: 'no-store'
                });

                const html = await response.text();
                addLog(`[Research] Query: "${q}" | HTML Length: ${html.length}`);

                if (html.length < 1000) {
                    addLog(`[Research] WARNING: Blocked. Body snippet: ${html.substring(0, 100)}`);
                }

                // Lite version parsing
                // Search for phone numbers in the entire raw text first
                // Then try to extract context
                const phoneMatch = Array.from(html.matchAll(/((\+91|91|0)?[6-9][0-9]{9})/g));
                addLog(`[Research] matches found: ${phoneMatch.length}`);

                const phonesFoundInThisStep = new Set<string>();

                for (const match of phoneMatch) {
                    const rawPhone = match[0];
                    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

                    if (cleanPhone.length >= 10 && cleanPhone.length <= 12) {
                        if (phonesFoundInThisStep.has(cleanPhone)) continue;
                        phonesFoundInThisStep.add(cleanPhone);

                        const index = match.index || 0;
                        const surroundingText = html.substring(Math.max(0, index - 150), Math.min(html.length, index + 150));

                        // Clean up text
                        const cleanText = surroundingText
                            .replace(/<[^>]*>/g, ' ') // Strip HTML
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();

                        // Fallback name logic
                        let name = `${category} Supplier`;
                        // Try to find a capitalized sequence before the number
                        const nameMatch = cleanText.split(rawPhone)[0].match(/([A-Z][a-zA-Z0-9&]+(?:\s[A-Z][a-zA-Z0-9&]+){0,4})/g);
                        if (nameMatch && nameMatch.length > 0) {
                            // Pick the last realistic looking name part before the phone
                            name = nameMatch[nameMatch.length - 1];
                        }

                        results.push({
                            name: name.substring(0, 50), // Truncate if too long
                            phone: cleanPhone,
                            website: null,
                            location: location,
                            description: cleanText.substring(0, 200),
                            source: "DuckDuckGo Lite"
                        });
                    }
                }

            } catch (err) {
                addLog(`[Research] Failed query: ${q} - ${(err as Error).message}`);
            }
        }

        // De-duplicate by phone across all queries
        const unique = new Map();
        for (const item of results) {
            if (!unique.has(item.phone)) {
                unique.set(item.phone, item);
            }
        }

        const finalResults = Array.from(unique.values()).slice(0, 10); // increased limit
        addLog(`[Research] Found ${finalResults.length} unique suppliers.`);
        return { suppliers: finalResults, logs };

    } catch (error) {
        addLog(`[Research] Critical Error: ${(error as Error).message}`);
        return { suppliers: [], logs };
    }
}
