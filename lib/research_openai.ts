import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export interface DiscoveredSupplier {
    name: string;
    phone: string | null;
    website: string | null;
    location: string | null;
    description: string;
    source: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Supabase lazily
let supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
    if (!supabase) {
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return supabase;
}

let openai: OpenAI | null = null;
function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

function cleanPhone(phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('91') && digits.length === 12) return digits.substring(2);
    if (digits.startsWith('0') && digits.length === 11) return digits.substring(1);
    return digits;
}

function isValidIndianPhone(phone: string | null): boolean {
    if (!phone) return false;
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length === 10 && /^[6-9]/.test(digits);
}

async function generateSearchQueries(category: string, location: string, addLog: (msg: string) => void): Promise<string[]> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Generate 4 diverse search queries to find mobile/electronics wholesalers/manufacturers in India.
                    Mix general terms with specific market names like "Gaffar Market", "Karol Bagh", "Nehru Place" if relevant to the category.
                    Focus on: ${category} in ${location}. Focus on contact numbers. Return as JSON: { "queries": [] }`
                },
                { role: "user", content: `Category: ${category}, Location: ${location}` }
            ],
            response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(response.choices[0].message.content || "{}");
        return parsed.queries || [`${category} wholesalers in ${location} contact number`];
    } catch {
        return [`${category} wholesalers in ${location} phone numbers`];
    }
}

async function safeFetch(url: string, referer: string = 'https://www.google.com/'): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': referer,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        return response.ok ? await response.text() : null;
    } catch { return null; }
}

async function extractSuppliersWithAI(html: string, category: string, location: string, sourceName: string, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    const cleanText = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, " ")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, " ")
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 25000);

    if (cleanText.length < 500) return [];

    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Extract business names and Indian phone numbers from this search page text. 
                    Format as JSON: { "suppliers": [ { "name": "...", "phone": "...", "description": "..." } ] }`
                },
                { role: "user", content: `Category: ${category}\n\nPage Content:\n${cleanText}` }
            ],
            response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(response.choices[0].message.content || "{}");
        return (parsed.suppliers || []).map((s: any) => ({
            name: s.name,
            phone: cleanPhone(s.phone),
            website: null,
            location: location,
            description: s.description || `${category} wholesaler`,
            source: sourceName
        })).filter((s: any) => isValidIndianPhone(s.phone));
    } catch { return []; }
}

async function getSuppliersFromAIKnowledge(category: string, location: string, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    addLog(`[Research] 🧠 Fetching top recommendations from AI knowledge base...`);
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a Sourcing Expert. Provide a comprehensive list of 15 well-known mobile/electronics wholesalers or manufacturers specifically in the given location in India. 
                    Focus on: ${category}. 
                    Include their 10-digit Indian phone numbers. 
                    IMPORTANT: Provide REAL businesses that are famous in the wholesale markets. 
                    Return as JSON: { "suppliers": [ { "name": "...", "phone": "...", "description": "..." } ] }`
                },
                { role: "user", content: `Category: ${category}, Location: ${location}` }
            ],
            response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(response.choices[0].message.content || "{}");
        return (parsed.suppliers || []).map((s: any) => ({
            name: s.name,
            phone: cleanPhone(s.phone),
            website: null,
            location: location,
            description: s.description || `${category} wholesaler in ${location}`,
            source: "AI Knowledge Base"
        })).filter((s: any) => isValidIndianPhone(s.phone));
    } catch { return []; }
}

export async function findSuppliers(category: string, location: string = "India"): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => { console.log(msg); logs.push(msg); };
    const results: DiscoveredSupplier[] = [];

    addLog(`[Research] 🔍 Initiating deep research for "${category}" in "${location}"...`);

    // 1. Check Local Database
    try {
        addLog(`[Research] 📂 Checking local database...`);
        const { data: dbSuppliers } = await getSupabase()
            .from('suppliers')
            .select('name, phone, location')
            .ilike('name', `%${category.split(' ')[0]}%`)
            .limit(10);

        if (dbSuppliers && dbSuppliers.length > 0) {
            results.push(...(dbSuppliers as any[]).map((s: any) => ({
                name: s.name,
                phone: s.phone,
                website: null,
                location: s.location,
                description: "Previously discovered supplier.",
                source: "Database"
            })));
            addLog(`[Research] ✅ Found ${dbSuppliers.length} matching in database.`);
        }
    } catch (e) {
        addLog(`[Research] DB Check skipped: ${(e as Error).message}`);
    }

    // 2. Scraping with better fallback
    if (results.length < 10) {
        const queries = await generateSearchQueries(category, location, addLog);

        for (const q of queries) {
            addLog(`[Research] 🌐 Searching: ${q}`);

            // Try Google Basic first
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&gbv=1`;
            let html = await safeFetch(googleUrl, 'https://www.google.com/');
            let source = "Google Search";

            if (!html || html.includes('detected unusual traffic')) {
                // Try DuckDuckGo
                source = "DuckDuckGo";
                html = await safeFetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
            }

            if (html && !html.includes('anomaly.js') && !html.includes('redirect')) {
                const found = await extractSuppliersWithAI(html, category, location, source, addLog);
                if (found.length > 0) {
                    addLog(`[Research] ✅ Found ${found.length} items from ${source}.`);
                    results.push(...found);
                }
            } else {
                addLog(`[Research] ⚠️ ${source} blocked the request (Bot detection).`);
            }

            if (results.length >= 15) break;
            await sleep(2000);
        }
    }

    // 3. AI Knowledge Fallback (Increased volume)
    if (results.length < 10) {
        const aiKnowledge = await getSuppliersFromAIKnowledge(category, location, addLog);
        results.push(...aiKnowledge);
    }

    const unique = new Map<string, DiscoveredSupplier>();
    results.forEach(s => { if (s.phone) unique.set(s.phone, s); });

    const finalResults = Array.from(unique.values());
    addLog(`[Research] ✨ Finalized ${finalResults.length} potential suppliers.`);

    return { suppliers: finalResults, logs };
}

export default findSuppliers;
