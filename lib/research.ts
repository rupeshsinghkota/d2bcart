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

// Helper to perform a robust fetch with browser headers
async function safeFetch(url: string, referer: string = 'https://www.google.com/'): Promise<string | null> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': referer,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            console.warn(`[Research] Fetch failed for ${url}: ${response.status} ${response.statusText}`);
            return null;
        }

        return await response.text();
    } catch (e) {
        console.error(`[Research] Fetch Error: ${(e as Error).message}`);
        return null;
    }
}

// AI Extraction Helper
async function extractSuppliersWithAI(html: string, category: string, location: string, sourceName: string, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    addLog(`[Research] 🧠 AI Analyzing ${sourceName} content for quality suppliers...`);

    // 1. Pre-processing: Extract relevant chunks (text with phone numbers) to reduce token usage
    // We roughly grab text around numbers, but wider context
    const phoneMatches = Array.from(html.matchAll(/((\+91|91|0)?[6-9][0-9]{9})/g));
    if (phoneMatches.length === 0) return [];

    let relevantText = "";
    const processedIndices = new Set<number>();

    for (const match of phoneMatches) {
        const index = match.index || 0;
        // Check if we already covered this area
        let alreadyCovered = false;
        for (const i of processedIndices) {
            if (Math.abs(index - i) < 300) { alreadyCovered = true; break; }
        }
        if (alreadyCovered) continue;
        processedIndices.add(index);

        const chunk = html.substring(Math.max(0, index - 250), Math.min(html.length, index + 250));
        // Strip HTML tags for clean text
        const cleanChunk = chunk.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        relevantText += `... ${cleanChunk} ...\n`;
    }

    if (relevantText.length < 50) return [];

    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert Data Extractor. Your goal is to Identify WHOLESALERS and MANUFACTURERS from the provided text snippets.
                    
                    CRITERIA:
                    1.  **Ignore** Repair Shops, Service Centers, Retailers (unless they explicitly say Wholesale).
                    2.  **Ignore** Generic directory listings (Justdial, Indiamart) unless a specific vendor name is clear.
                    3.  **Extract**: Business Name, Phone Number, Description.
                    4.  **Format**: Return a JSON Object with a key "suppliers" containing an array.
                    
                    Example: { "suppliers": [ { "name": "Royal Traders", "phone": "9999999999", "description": "Wholesaler of mobile covers" } ] }`
                },
                {
                    role: "user",
                    content: `Category: ${category}, Location: ${location}\n\nInput Text:\n${relevantText.substring(0, 15000)}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);

        if (parsed.suppliers && Array.isArray(parsed.suppliers)) {
            return parsed.suppliers.map((s: any) => ({
                name: s.name,
                phone: s.phone.replace(/[^0-9]/g, ''),
                website: null,
                location: location,
                description: s.description,
                source: `${sourceName} + AI Filter`
            }));
        }
        return [];

    } catch (e) {
        addLog(`[Research] AI Extraction Failed: ${(e as Error).message}`);
        // Fallback to regex if AI fails?
        return extractSuppliersFromHtml(html, category, location, sourceName);
    }
}

// Serper API Search (Google)
async function searchWithSerper(query: string, category: string, location: string, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return [];

    const url = 'https://google.serper.dev/search';
    addLog(`[Research] 🚀 Using Serper API (Google) for query: "${query}"`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, num: 20 })
        });

        if (!response.ok) {
            addLog(`[Research] Serper API Error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const organic = data.organic || [];

        // Convert Serper results to text for AI extraction
        // We simulate "HTML" by checking the snippets
        let simulatedMeta = "";
        organic.forEach((item: any) => {
            simulatedMeta += `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}\n\n`;
        });

        // Use the same AI extractor on this high-quality text
        return await extractSuppliersWithAI(simulatedMeta, category, location, "Serper (Google API)", addLog);

    } catch (e) {
        addLog(`[Research] Serper Failed: ${(e as Error).message}`);
        return [];
    }
}

// Generic Phone Extractor from HTML
function extractSuppliersFromHtml(html: string, category: string, location: string, sourceName: string): DiscoveredSupplier[] {
    const extracted: DiscoveredSupplier[] = [];
    const phoneMatch = Array.from(html.matchAll(/((\+91|91|0)?[6-9][0-9]{9})/g));
    const phonesFound = new Set<string>();

    for (const match of phoneMatch) {
        const rawPhone = match[0];
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

        if (cleanPhone.length >= 10 && cleanPhone.length <= 12) {
            if (phonesFound.has(cleanPhone)) continue;
            phonesFound.add(cleanPhone);

            const index = match.index || 0;
            // Get wider context for Bing which is often verbose
            const surroundingText = html.substring(Math.max(0, index - 200), Math.min(html.length, index + 200));

            const cleanText = surroundingText
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Name guessing
            let name = `${category} Supplier`;
            // Try to find a capitalized sequence before the number
            const nameMatch = cleanText.split(rawPhone)[0].match(/([A-Z][a-zA-Z0-9&]+(?:\s[A-Z][a-zA-Z0-9&]+){0,4})/g);
            if (nameMatch && nameMatch.length > 0) {
                name = nameMatch[nameMatch.length - 1];
            }

            extracted.push({
                name: name.substring(0, 50),
                phone: cleanPhone,
                website: null,
                location: location,
                description: cleanText.substring(0, 200),
                source: sourceName
            });
        }
    }
    return extracted;
}

export async function findSuppliers(category: string, location: string = "India"): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    const useApi = !!process.env.SERPER_API_KEY;
    addLog(`[Research] Searching for suppliers in category (${useApi ? 'Google API Mode 🚀' : 'Free Mode 🕸️'}): ${category} in ${location}`);
    const results: DiscoveredSupplier[] = [];

    try {
        // 1. Generate Queries via AI
        // We need to update the prompt inside the function above to ensure valid JSON object response.
        const queries = await generateSearchQueries(category, location, addLog);

        for (const q of queries) {

            // PRIORITY 1: SERPER API (If Key Exists)
            if (useApi) {
                const found = await searchWithSerper(q, category, location, addLog);
                if (found.length > 0) {
                    addLog(`[Research] Serper found ${found.length} suppliers.`);
                    results.push(...found);
                    continue; // Skip scraping if API works
                }
            }

            // PRIORITY 2: FREE SCRAPING (Fallback/Default)
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

            // USE AI EXTRACTION INSTEAD OF REGEX
            const found = await extractSuppliersWithAI(html, category, location, source, addLog);

            addLog(`[Research] 🧠 AI identified ${found.length} valid wholesalers.`);
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
