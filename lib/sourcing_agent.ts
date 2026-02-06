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
    imageUrl?: string,
    supplierId?: string,
    description?: string,
    customContext?: string // NEW: User-provided sourcing instructions
}): Promise<SourcingResponse> {
    const { message, phone, imageUrl, supplierId, description, customContext } = params;

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
- Description: ${description || supplier?.description || 'Mobile accessories wholesaler'}
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
    const systemPrompt = `You are a Senior Purchasing Manager for D2BCart, India's leading B2B marketplace for mobile accessories.
You are initiating contact with a new potential wholesale partner.

${contextStr}

CONVERSATION HISTORY:
${history.join('\n')}

CORE OBJECTIVES:
1. FIRST CONTACT (CRITICAL - BE CONVINCING): 
   - Introduce yourself as: "Sourcing Team from D2BCart (India's leading B2B mobile portal, based in Delhi)"
   - Reference the Supplier Name: "${supplier?.name || 'Sir/Madam'}"
   - MENTION THEIR HUB/LOCATION: If location is known (e.g. Karol Bagh, Nehru Place), mention it. (e.g., "Since we both operate out of the ${supplier?.location || 'Delhi'} market hub, we're looking to onboard reliable local partners").
   - HIGHLIGHT SPECIALTY: Reference the "Description". If they do "silicone cases", mention that specifically. Do NOT say "mobile accessories" if the description says "Premium iPhone covers".
   ${customContext ? `- SPECIFIC USER GOAL: ${customContext}\n   - (MANDATORY: Weave this into the greeting seamlessly!)` : ''}
   - SHOW HIGH-VOLUME INTENT: Mention we are looking to onboard reliable partners for pan-India distribution.
   - CALL TO ACTION: Ask for their "Latest WhatsApp Catalog" or "Fresh Price List".

2. TONE & FORMAT (CONSTRAINTS): 
   - DO NOT SOUND LIKE A BOT. No "Dear", "Respected", or "I am writing to...".
   - Start directly: "Hello ${supplier?.name || 'Sir'}, this is..."
   - EXTREMELY COMPACT: Maximum 15-20 words for first contact. No fluff.
   - ABSOLUTELY NO NEWLINES (\n). The entire message must be one single paragraph.
   - End with: "Regards, D2BCart Sourcing Team"

RESPONSE FORMAT (JSON ONLY):
{
  "reasoning": "Internal logic for this message",
  "message": "The personalized WhatsApp message to send",
  "action": "ask_catalog|ask_price|negotiate|verify_identity|save_details|end_chat|none",
  "update_supplier": { 
    "negotiation_stage": "initial|catalog_received|pricing|negotiating|verified|closed",
    "conversation_summary": "One-line summary"
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
