/**
 * Enhanced Sourcing Agent v2
 * Features: Vision AI, Better Context, Price Comparison, Auto-Negotiation
 */

import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { detectImageType, analyzeProductImage, extractVisitingCard, extractPriceList } from './vision_ai';

// Singletons
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

// Enhanced Response Interface
export interface SourcingResponse {
    reasoning: string;
    message: string;
    action: 'ask_catalog' | 'ask_price' | 'negotiate' | 'save_details' | 'verify_identity' | 'end_chat' | 'none';
    extracted_data?: {
        product_name?: string;
        price?: string;
        moq?: string;
        gst_number?: string;
        verified?: boolean;
    };
    update_supplier?: {
        last_quoted_price?: number;
        last_moq?: number;
        is_verified?: boolean;
        gst_number?: string;
        deal_score?: number;
        negotiation_stage?: string;
        conversation_summary?: string;
    };
}

// Fetch enhanced supplier context
async function getSupplierContext(phone: string) {
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');

    const { data: supplier } = await getSupabase()
        .from('suppliers')
        .select('*')
        .eq('phone', cleanPhone)
        .single();

    return supplier || null;
}

// Fetch chat history with metadata
async function getSupplierHistory(phone: string) {
    try {
        const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
        const { data } = await getSupabase()
            .from('whatsapp_chats')
            .select('message, direction, created_at, metadata')
            .or(`mobile.eq.${cleanPhone},mobile.eq.+${cleanPhone}`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!data) return [];
        return data.reverse().map(m => {
            const role = m.direction === 'inbound' ? 'Supplier' : 'Agent';
            const hasImage = m.metadata?.contentType === 'image';
            return `${role}: ${hasImage ? '[IMAGE] ' : ''}${m.message}`;
        });
    } catch (e) {
        return [];
    }
}

// Get average price for category comparison
async function getCategoryAveragePrice(category: string): Promise<number | null> {
    try {
        const { data } = await getSupabase()
            .from('suppliers')
            .select('last_quoted_price')
            .eq('category', category)
            .not('last_quoted_price', 'is', null)
            .gt('last_quoted_price', 0);

        if (!data || data.length === 0) return null;

        const prices = data.map(s => Number(s.last_quoted_price)).filter(p => p > 0);
        return prices.reduce((a, b) => a + b, 0) / prices.length;
    } catch (e) {
        return null;
    }
}

// Calculate deal score based on various factors
function calculateDealScore(supplier: any): number {
    let score = 50; // Base score

    if (supplier.is_verified) score += 20;
    if (supplier.status === 'responded') score += 10;
    if (supplier.last_quoted_price && supplier.last_quoted_price < 100) score += 10;
    if (supplier.follow_up_count === 0) score += 5; // Responsive
    if (supplier.follow_up_count > 2) score -= 10; // Unresponsive

    return Math.max(0, Math.min(100, score));
}

// Main Agent Function
export async function getSourcingAgentResponse(params: {
    message: string,
    phone: string,
    imageUrl?: string, // NEW: Image URL if message contains image
    supplierId?: string
}): Promise<SourcingResponse> {
    const { message, phone, imageUrl, supplierId } = params;

    // 1. Gather Enhanced Context
    const supplier = await getSupplierContext(phone);
    const history = await getSupplierHistory(phone);
    const category = supplier?.category || 'mobile accessories';
    const avgPrice = await getCategoryAveragePrice(category);

    // 2. Process Image if present (Vision AI)
    let imageAnalysis = '';
    let extractedFromImage: any = {};

    if (imageUrl) {
        console.log('[Sourcing Agent v2] Processing image:', imageUrl);
        const imageType = await detectImageType(imageUrl);
        console.log('[Sourcing Agent v2] Image type:', imageType);

        if (imageType === 'visiting_card') {
            const cardData = await extractVisitingCard(imageUrl);
            extractedFromImage = { ...cardData };
            imageAnalysis = `[VISITING CARD DETECTED]
Extracted: Name: ${cardData.name || 'N/A'}, Company: ${cardData.company || 'N/A'}, Phone: ${cardData.phone || 'N/A'}, GST: ${cardData.gst_number || 'N/A'}`;

            // Auto-update supplier with extracted data
            if (supplier && cardData.gst_number) {
                extractedFromImage.gst_number = cardData.gst_number;
                extractedFromImage.verified = true;
            }
        } else if (imageType === 'catalog' || imageType === 'product') {
            const productData = await analyzeProductImage(imageUrl);
            imageAnalysis = `[PRODUCT/CATALOG IMAGE]
Products Found: ${productData.products.map(p => p.name).join(', ') || 'Unable to identify'}
Has Prices: ${productData.has_prices ? 'Yes' : 'No'}`;

            if (productData.extracted_prices && productData.extracted_prices.length > 0) {
                imageAnalysis += `\nPrices: ${productData.extracted_prices.map(p => `${p.product}: ${p.price}`).join(', ')}`;

                // Extract first price as reference
                const firstPrice = productData.extracted_prices[0];
                if (firstPrice.price) {
                    const numPrice = parseFloat(firstPrice.price.replace(/[^0-9.]/g, ''));
                    if (!isNaN(numPrice)) {
                        extractedFromImage.price = String(numPrice);
                    }
                }
            }
        } else if (imageType === 'price_list') {
            const prices = await extractPriceList(imageUrl);
            imageAnalysis = `[PRICE LIST IMAGE]
Extracted ${prices.length} prices: ${prices.slice(0, 5).map(p => `${p.product}: ${p.price}`).join(', ')}`;

            if (prices.length > 0) {
                const firstPrice = prices[0];
                const numPrice = parseFloat(firstPrice.price.replace(/[^0-9.]/g, ''));
                if (!isNaN(numPrice)) {
                    extractedFromImage.price = String(numPrice);
                    extractedFromImage.product_name = firstPrice.product;
                }
            }
        } else {
            imageAnalysis = `[IMAGE RECEIVED - Type: ${imageType}]`;
        }
    }

    // 3. Build Enhanced Context String
    let contextStr = `SUPPLIER INFO:
- Name: ${supplier?.name || 'Unknown'}
- Category: ${category}
- Status: ${supplier?.status || 'new'}
- Verified: ${supplier?.is_verified ? 'Yes ✅' : 'No ❌'}
- Deal Score: ${supplier?.deal_score || 0}/100
- Last Quoted Price: ${supplier?.last_quoted_price ? `₹${supplier.last_quoted_price}` : 'Not quoted yet'}
- Negotiation Stage: ${supplier?.negotiation_stage || 'initial'}`;

    if (avgPrice) {
        contextStr += `\n\nMARKET DATA:
- Average Price in Category: ₹${avgPrice.toFixed(2)}
- Price Comparison: ${supplier?.last_quoted_price ?
                (supplier.last_quoted_price > avgPrice * 1.2 ? '⚠️ ABOVE AVERAGE - NEGOTIATE!' :
                    (supplier.last_quoted_price < avgPrice * 0.8 ? '✅ GOOD DEAL' : '➡️ FAIR PRICE')) : 'N/A'}`;
    }

    if (imageAnalysis) {
        contextStr += `\n\nIMAGE ANALYSIS:\n${imageAnalysis}`;
    }

    // 4. Generate AI Response
    const systemPrompt = `You are an expert Purchasing Agent for D2BCart, India's leading wholesale mobile accessories platform.
You are negotiating with suppliers to get the best prices.

${contextStr}

CONVERSATION HISTORY:
${history.join('\n')}

YOUR OBJECTIVES (IN ORDER):
1. FIRST CONTACT: Introduce as "Sourcing Team from D2BCart" and ask for catalog
2. RECEIVED IMAGES: 
   - If visiting card/GST → Thank them and ask for product catalog
   - If product images → Ask for WHOLESALE PRICE and MOQ
3. RECEIVED PRICE: 
   - Compare with market average (provided above)
   - If >20% above average → NEGOTIATE HARD
   - If fair → Ask for verification (Visiting Card/GST)
4. VERIFICATION: Always ask for GST/Visiting Card before finalizing

NEGOTIATION TACTICS:
- Mention you're a large buyer ("We do 1000+ units monthly")
- Ask for bulk discount ("What's best price for 500 pcs?")
- Compare with competitors ("Other suppliers offer ₹X")
- Be firm but polite

RESPONSE FORMAT (JSON ONLY):
{
  "reasoning": "Your internal analysis",
  "message": "WhatsApp message to supplier (keep short, professional)",
  "action": "ask_catalog|ask_price|negotiate|verify_identity|save_details|end_chat|none",
  "extracted_data": { "product_name": "...", "price": "...", "moq": "...", "gst_number": "..." },
  "update_supplier": { 
    "last_quoted_price": number, 
    "negotiation_stage": "initial|catalog_received|pricing|negotiating|verified|closed",
    "conversation_summary": "One-line summary of conversation so far"
  }
}`;

    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message || (history.length === 0 ? "[INITIATE FIRST CONTACT]" : "[CONTINUE CONVERSATION]") }
            ]
        });

        const content = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);

        console.log(`[Sourcing Agent v2] Reasoning: ${parsed.reasoning}`);
        console.log(`[Sourcing Agent v2] Action: ${parsed.action}`);

        // Merge extracted data from Vision AI
        const finalExtracted = { ...parsed.extracted_data, ...extractedFromImage };

        return {
            reasoning: parsed.reasoning || "No reasoning",
            message: parsed.message || "Can you share more details?",
            action: parsed.action || "none",
            extracted_data: finalExtracted,
            update_supplier: parsed.update_supplier
        };

    } catch (e) {
        console.error("Sourcing Agent v2 Error:", e);
        return {
            reasoning: "Error occurred",
            message: "Could you please share that again?",
            action: "none"
        };
    }
}
