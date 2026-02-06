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
                    content: `Generate 3 search queries to find mobile/electronics wholesalers/manufacturers in India.
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
                'Referer': referer
            }
        });
        return response.ok ? await response.text() : null;
    } catch { return null; }
}

async function extractSuppliersWithAI(html: string, category: string, location: string, sourceName: string, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    // Very simple cleaning: just remove tags but keep context
    const cleanText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 20000);

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

// AI Knowledge Fallback
async function getSuppliersFromAIKnowledge(category: string, location: string, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    addLog(`[Research] 🧠 Fetching top recommendations from AI knowledge base...`);
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a Sourcing Expert. Provide a list of 5 well-known mobile/electronics wholesalers or manufacturers specifically in the given location in India. 
                    Focus on: ${category}. 
                    Include their 10-digit Indian phone numbers. 
                    IMPORTANT: Only provide REAL businesses if possible, or very realistic examples if not. 
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

    // 1. Check Local Database first
    try {
        addLog(`[Research] 📂 Checking local database for existing suppliers...`);
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
            addLog(`[Research] ✅ Found ${dbSuppliers.length} matching suppliers in database.`);
        }
    } catch (e) {
        addLog(`[Research] DB Check skipped: ${(e as Error).message}`);
    }

    // 2. Try Scraping (if key results missing)
    if (results.length < 5) {
        const queries = await generateSearchQueries(category, location, addLog);

        for (const q of queries) {
            addLog(`[Research] 🌐 Searching: ${q}`);
            const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
            const html = await safeFetch(url);

            if (html && !html.includes('anomaly.js')) {
                const found = await extractSuppliersWithAI(html, category, location, "DuckDuckGo", addLog);
                if (found.length > 0) {
                    addLog(`[Research] ✅ Found ${found.length} live results.`);
                    results.push(...found);
                }
            } else {
                addLog(`[Research] ⚠️ Search engine challenged the request (Bot detection).`);
            }

            if (results.length >= 10) break;
            await sleep(1500);
        }
    }

    // 3. AI Knowledge Fallback
    if (results.length < 3) {
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
