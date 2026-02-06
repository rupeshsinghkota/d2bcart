import OpenAI from 'openai';

export interface DiscoveredSupplier {
    name: string;
    phone: string | null;
    website: string | null;
    location: string | null;
    description: string;
    source: string;
}

// export interface DiscoveredSupplier { ... } defines it earlier or later?
// Wait, let's keep the interface at the top.


let openai: OpenAI | null = null;
function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
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

// AI Query Generation
async function generateSearchQueries(category: string, location: string, addLog: (msg: string) => void): Promise<string[]> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a Sourcing Expert in India. Generate 3 specific search queries to find WHOLESALERS or MANUFACTURERS for the given category and location.
                    Focus on finding business phone numbers. 
                    Return the result as a JSON object with a key "queries" containing an array of strings.`
                },
                { role: "user", content: `Category: ${category}, Location: ${location}` }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);
        return parsed.queries || [`${category} wholesalers in ${location} contact`];
    } catch (e) {
        addLog(`[Research] AI Query Generation Failed: ${(e as Error).message}`);
        return [`${category} wholesalers in ${location} phone number`];
    }
}

// Helper to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

async function safeFetch(url: string, referer: string = 'https://www.google.com/'): Promise<string | null> {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': ua,
                'Referer': referer,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        if (!response.ok) return null;
        return await response.text();
    } catch {
        return null;
    }
}

// AI Extraction from Search Results
async function extractSuppliersWithAI(html: string, category: string, location: string, sourceName: string, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    const cleanText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Quick check for phone numbers to avoid wasting tokens
    if (!/((\+91|91|0)?[6-9][0-9]{9})/.test(cleanText)) return [];

    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Extract WHOLESALERS/MANUFACTURERS from the search results. 
                    Filter: ONLY include businesses with names and 10-digit Indian phones. 
                    Exclude: Repair shops, retailers, generic directories.
                    Return the data as a JSON object with this format: { "suppliers": [ { "name": "...", "phone": "...", "description": "..." } ] }`
                },
                { role: "user", content: `Category: ${category}, Location: ${location}\n\nSearch Content: ${cleanText.substring(0, 15000)}` }
            ],
            response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(response.choices[0].message.content || "{}");
        if (!parsed.suppliers) return [];

        return parsed.suppliers
            .map((s: any) => ({
                name: s.name,
                phone: cleanPhone(s.phone),
                website: null,
                location: location,
                description: s.description || `${category} wholesaler`,
                source: sourceName
            }))
            .filter((s: any) => isValidIndianPhone(s.phone));
    } catch (e) {
        addLog(`[Research] AI Extraction Failed for ${sourceName}: ${(e as Error).message}`);
        return [];
    }
}

export async function findSuppliers(category: string, location: string = "India"): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    addLog(`[Research] 🧠 Starting OpenAI-based research for "${category}" in "${location}"...`);
    const results: DiscoveredSupplier[] = [];

    try {
        const queries = await generateSearchQueries(category, location, addLog);

        for (const q of queries) {
            addLog(`[Research] 🔍 Searching: "${q}"`);

            // Try Bing first as DDG Lite is blocking
            let html = await safeFetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, 'https://www.bing.com/');
            let source = "Bing Search";

            if (!html || html.length < 2000) {
                // Fallback to DuckDuckGo Lite
                addLog(`[Research] Bing returned low content. Trying DuckDuckGo Lite...`);
                html = await safeFetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, 'https://lite.duckduckgo.com/');
                source = "DuckDuckGo Lite";
            }

            if (html && html.length > 500) {
                addLog(`[Research] HTML Snippet (${source}): ${html.substring(0, 300).replace(/\n/g, ' ')}`);
                const found = await extractSuppliersWithAI(html, category, location, source, addLog);
                addLog(`[Research] ✅ Found ${found.length} unique suppliers from ${source}`);
                results.push(...found);
            }

            await sleep(2000); // More delay to avoid throttle
        }

        // Deduplicate
        const unique = new Map<string, DiscoveredSupplier>();
        for (const s of results) {
            if (s.phone && !unique.has(s.phone)) unique.set(s.phone, s);
        }

        const finalResults = Array.from(unique.values()).slice(0, 15);
        addLog(`[Research] ✨ Research complete. Found ${finalResults.length} high-quality suppliers.`);
        return { suppliers: finalResults, logs };

    } catch (error) {
        addLog(`[Research] ❌ Critical Error: ${(error as Error).message}`);
        return { suppliers: [], logs };
    }
}

export default findSuppliers;
