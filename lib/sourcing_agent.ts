
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DiscoveredSupplier } from './research';

// Reuse existing singletons if possible or create new
let openai: OpenAI | null = null;
let supabase: SupabaseClient | null = null;

function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

function getSupabase() {
    if (!supabase) {
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return supabase;
}

// Supplier context structure
interface SupplierContext {
    name: string;
    category: string;
    status: string;
    products_found: number;
}

export interface SourcingResponse {
    reasoning: string;
    message: string; // Text to send to supplier
    action: 'ask_catalog' | 'ask_price' | 'negotiate' | 'save_details' | 'end_chat' | 'none';
    extracted_data?: {
        product_name?: string;
        price?: string;
        moq?: string;
    };
}

// Helper to fetch chat history for context
async function getSupplierHistory(phone: string) {
    try {
        const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
        const { data } = await getSupabase()
            .from('whatsapp_chats')
            .select('message, direction, created_at')
            .or(`mobile.eq.${cleanPhone},mobile.eq.+${cleanPhone}`)
            .order('created_at', { ascending: false })
            .limit(15);

        if (!data) return [];
        return data.reverse().map(m => `${m.direction === 'inbound' ? 'Supplier' : 'Agent'}: ${m.message}`);
    } catch (e) {
        return [];
    }
}

// Main Agent Function
export async function getSourcingAgentResponse(params: {
    message: string,
    phone: string,
    supplierId?: string
}): Promise<SourcingResponse> {
    const { message, phone, supplierId } = params;

    // 1. Gather Context
    const history = await getSupplierHistory(phone);

    // Fetch supplier verification status if ID provided
    let supplierContextStr = "Unknown Supplier";
    if (supplierId) {
        const { data: supplier } = await getSupabase()
            .from('suppliers')
            .select('*')
            .eq('id', supplierId)
            .single();
        if (supplier) {
            supplierContextStr = `Supplier: ${supplier.name} | Category: ${supplier.category} | Status: ${supplier.status}`;
        }
    }

    const systemPrompt = `You are a Purchasing Agent for D2BCart, a large wholesale platform in India.
Your goal is to find high-quality ${supplierContextStr.includes('Category') ? 'items' : 'mobile accessories'} at the lowest possible prices.

CONTEXT:
${supplierContextStr}

HISTORY:
${history.join('\n')}

YOUR OBJECTIVES:
1. GREETING: If this is the first contact, introduce yourself as "Sourcing Team from D2BCart".
2. CATALOG: Ask for their latest wholesale catalog or photos of best-selling items.
3. PRICING: If they send photos, IMMEDIATELY ask for the Wholesale Price and MOQ.
4. VERIFICATION (CRITICAL): Before finalizing any deal, ask for their "Visiting Card" or "GST Certificate" to verify they are a genuine supplier.
   - Say: "To register you as a verified vendor in our system, please share your Visiting Card or GST."
5. NEGOTIATION: If price is high, negotiate.

RESPONSE FORMAT (JSON ONLY):
{
  "reasoning": "Internal thought process",
  "message": "The actual text to WhatsApp the supplier",
  "action": "ask_catalog|ask_price|verify_identity|negotiate|save_details|end_chat|none",
  "extracted_data": { "product_name": "...", "price": "...", "moq": "...", "verified": boolean }
}

RULES:
- Be professional but demanding (like a serious buyer).
- Keep messages short (WhatsApp style).
- If they share a document/image, acknowledge it.
- If they refuse to share details, mark action as 'end_chat'.
`;

    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini", // Cost effective for backend logic
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ]
        });

        const content = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);

        console.log(`[Sourcing Agent] Reasoning: ${parsed.reasoning}`);
        return {
            reasoning: parsed.reasoning || "No reasoning",
            message: parsed.message || "Can you share more details?",
            action: parsed.action || "none",
            extracted_data: parsed.extracted_data
        };

    } catch (e) {
        console.error("Sourcing Agent Error:", e);
        return {
            reasoning: "Error",
            message: "Could you please send your catalog again?",
            action: "none"
        };
    }
}
