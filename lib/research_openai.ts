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

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

async function safeFetch(url: string, referer: string = 'https://www.google.com/'): Promise<string | null> {
    try {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const response = await fetch(url, {
            headers: {
                'User-Agent': ua,
                'Referer': referer,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
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
        .substring(0, 30000);

    if (cleanText.length < 300) return [];

    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Extract business names and 10-digit Indian phone numbers for ${category} wholesalers in ${location}. 
                    Format as JSON: { "suppliers": [ { "name": "...", "phone": "...", "description": "..." } ] }`
                },
                { role: "user", content: `Page Content:\n${cleanText}` }
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

async function getSuppliersFromAIKnowledge(category: string, location: string, count: number = 20, addLog: (msg: string) => void): Promise<DiscoveredSupplier[]> {
    addLog(`[Research] 🧠 Fetching recommendations from AI knowledge base (Count: ${count})...`);
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a Sourcing Expert. Provide a list of ${count} REAL Indian mobile/electronics wholesalers/manufacturers in ${location}. 
                    Focus on: ${category}. Include their 10-digit Indian phone numbers.
                    Return as JSON: { "suppliers": [ { "name": "...", "phone": "...", "description": "..." } ] }`
                }
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
            source: "AI Knowledge Base"
        })).filter((s: any) => isValidIndianPhone(s.phone));
    } catch { return []; }
}

export async function findSuppliers(category: string, location: string = "India"): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => { console.log(msg); logs.push(msg); };
    const results: DiscoveredSupplier[] = [];

    addLog(`[Research] 🔍 Researching "${category}" in "${location}"...`);

    // 1. Scraping with aggressive fallback
    const qBase = `${category} wholesalers ${location} contact number`;
    const searchEngines = [
        { name: "Ask.com", url: `https://www.ask.com/web?q=${encodeURIComponent(qBase)}` },
        { name: "DuckDuckGo", url: `https://duckduckgo.com/html/?q=${encodeURIComponent(qBase)}` },
        { name: "Google Basic", url: `https://www.google.com/search?q=${encodeURIComponent(qBase)}&gbv=1` }
    ];

    for (const engine of searchEngines) {
        addLog(`[Research] 🌐 Trying ${engine.name}...`);
        const html = await safeFetch(engine.url);

        if (html && !html.includes('detected unusual traffic') && !html.includes('anomaly.js')) {
            const found = await extractSuppliersWithAI(html, category, location, engine.name, addLog);
            if (found.length > 0) {
                addLog(`[Research] ✅ Found ${found.length} from ${engine.name}.`);
                results.push(...found);
            } else {
                addLog(`[Research] ⚠️ No suppliers extracted from ${engine.name}.`);
            }
        } else {
            addLog(`[Research] ❌ ${engine.name} blocked/failed.`);
        }

        if (results.length >= 10) break;
        await sleep(1000);
    }

    // 2. AI Knowledge Fallback (High Volume)
    if (results.length < 5) {
        const aiKnowledge = await getSuppliersFromAIKnowledge(category, location, 25, addLog);
        results.push(...aiKnowledge);
    }

    // 4. FILTER OUT EXISTING SUPPLIERS FROM DB
    const unique = new Map<string, DiscoveredSupplier>();
    results.forEach(s => { if (s.phone) unique.set(s.phone, s); });

    let finalResults = Array.from(unique.values());

    try {
        const phones = finalResults.map(s => s.phone).filter(Boolean) as string[];
        if (phones.length > 0) {
            const { data: existing } = await getSupabase()
                .from('suppliers')
                .select('phone')
                .in('phone', phones);

            if (existing && (existing as any[]).length > 0) {
                const existingPhones = new Set((existing as any[]).map(e => e.phone));
                finalResults = finalResults.filter(s => !existingPhones.has(s.phone!));
                addLog(`[Research] 🧹 Filtered already known suppliers.`);
            }
        }
    } catch (e) {
        addLog(`[Research] Filtering error: ${(e as Error).message}`);
    }

    addLog(`[Research] ✨ Finalized ${finalResults.length} new potential suppliers.`);
    return { suppliers: finalResults, logs };
}

export default findSuppliers;
