
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
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

// Response type for AI messages
export interface AIMessage {
    type: 'text' | 'image';
    text: string;
    imageUrl?: string;
    productName?: string;
}

// Get customer details by phone
async function getCustomer(phone: string) {
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    const last10 = cleanPhone.slice(-10);

    const { data } = await getSupabase()
        .from('users')
        .select('id, business_name, phone, user_type, created_at')
        .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.91${last10},phone.eq.+91${last10}`)
        .single();
    return data;
}

// Get customer's recent orders
async function getCustomerOrders(userId: string) {
    const { data } = await getSupabase()
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, tracking_number')
        .eq('retailer_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
    return data || [];
}

// Search products with images
// Search products with images (Scored by relevance)
async function searchProducts(query: string) {
    // Filter out common stop words to avoid "Cover" matching 1000 random things
    const stopWords = new Set(['the', 'for', 'in', 'of', 'with', 'cover', 'case', 'back', 'mobile', 'phone']);
    let keywords = query.toLowerCase().split(' ')
        .map(w => w.replace(/[^a-z0-9]/g, '')) // clean punctuation
        .filter(w => w.length > 1);

    // If we have specific keywords, ignore generic ones. If ONLY generic, keep them.
    const specificKeywords = keywords.filter(w => !stopWords.has(w));
    if (specificKeywords.length > 0) {
        keywords = specificKeywords;
    }

    const counts = new Map<string, number>();
    const productMap = new Map<string, any>();

    for (const keyword of keywords) {
        try {
            const { data } = await getSupabase()
                .from('products')
                .select('id, name, slug, base_price, display_price, moq, stock, images')
                .ilike('name', `%${keyword}%`)
                .eq('is_active', true)
                .limit(20); // Fetch more candidates

            if (data) {
                for (const p of data) {
                    counts.set(p.id, (counts.get(p.id) || 0) + 1);
                    productMap.set(p.id, p);
                }
            }
        } catch (e) { }
    }

    if (productMap.size === 0) {
        // Fallback: Newest products if totally empty? Or strict empty?
        // Let's return empty so AI knows "No Match".
        // AI will fall back to "Top Products" context.
        return [];
    }

    // Sort by relevance (count desc) -> then newest
    // IMPROVED SCORING: Deduct points for model mismatches (Pro, Max, Ultra)
    const modifiers = ['pro', 'max', 'plus', 'ultra', 'lite', 'mini', 'note', 'edge', 'prime'];

    const sorted = [...productMap.values()].sort((a, b) => {
        let scoreA = counts.get(a.id) || 0;
        let scoreB = counts.get(b.id) || 0;

        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // Penalty Logic
        for (const mod of modifiers) {
            const qHas = query.toLowerCase().includes(mod);
            if (qHas !== nameA.includes(mod)) scoreA -= 0.5; // Mismatch
            if (qHas !== nameB.includes(mod)) scoreB -= 0.5; // Mismatch
        }

        if (scoreB !== scoreA) return scoreB - scoreA;
        return 0;
    });

    return sorted.slice(0, 10);
}

// Get all categories
async function getCategories() {
    const { data } = await getSupabase().from('categories').select('id, name, slug').limit(30);
    return data || [];
}

// Get top products with images
async function getTopProducts() {
    const { data } = await getSupabase()
        .from('products')
        .select('name, slug, display_price, images')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
    return data || [];
}

// Get chat history
async function getChatHistory(dateObj: any, phone: string) {
    // Only attempt if table exists (handled by try-catch inside or user setup)
    try {
        const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
        // We match loosely on phone substring or precise
        const { data } = await getSupabase()
            .from('whatsapp_chats')
            .select('message, direction, created_at')
            .or(`mobile.eq.${cleanPhone},mobile.eq.+${cleanPhone}`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!data) return [];
        return data.reverse().map(m => `${m.direction === 'inbound' ? 'User' : 'Assistant'}: ${m.message}`);
    } catch (e) {
        return [];
    }
}

export async function getSalesAssistantResponse(params: {
    message: string,
    phone: string,
}): Promise<AIMessage[]> {
    const { message, phone } = params;

    // Parallelize detailed context fetching
    const [customer, categories, matchingProducts, topProducts, history] = await Promise.all([
        getCustomer(phone),
        getCategories(),
        searchProducts(message),
        getTopProducts(),
        getChatHistory(null, phone)
    ]);

    // Fetch orders only if customer exists
    const orders = customer ? await getCustomerOrders(customer.id) : [];

    const categoryContext = categories.map(c =>
        `• ${c.name}: https://d2bcart.com/products?category=${c.slug}`
    ).join('\n');

    const productContext = matchingProducts.length > 0
        ? matchingProducts.map(p =>
            `• ${p.name} | Retail: ₹${p.display_price} | Wholesale: ₹${p.base_price} | MOQ: ${p.moq || 1} | Stock: ${p.stock || 'Available'} | Image: ${p.images?.[0] || 'none'} | URL: https://d2bcart.com/products/${p.slug}`
        ).join('\n')
        : '';

    const topProductContext = topProducts.map(p =>
        `• ${p.name} - ₹${p.display_price} | Image: ${p.images?.[0] || 'none'}: https://d2bcart.com/products/${p.slug}`
    ).join('\n');

    let customerContext = "NEW VISITOR";
    if (customer) {
        customerContext = `CUSTOMER: ${customer.business_name || 'Retailer'}, Member since ${new Date(customer.created_at).toLocaleDateString()}`;
        if (orders.length > 0) {
            customerContext += `\nORDERS:\n` + orders.map(o =>
                `#${o.order_number}: ₹${o.total_amount} - ${o.status}${o.tracking_number ? ` - Track: ${o.tracking_number}` : ''}`
            ).join('\n');
        }
    }

    const historyContext = history.length > 0 ? `HISTORY:\n${history.join('\n')}` : "HISTORY: None";

    const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 600,
        messages: [
            {
                role: "system",
                content: `You are D2BCart AI Sales Assistant for B2B mobile accessories wholesale.

WEBSITE: https://d2bcart.com
SUPPORT: WhatsApp 917557777987

CATEGORIES:
${categoryContext}

${productContext ? `MATCHING PRODUCTS:\n${productContext}` : 'NO EXACT MATCH'}

TOP PRODUCTS:
${topProductContext}

${customerContext}

${historyContext}

RESPONSE FORMAT (CRITICAL):
You must respond in a JSON object with a reasoning field and a messages array:

{
  "reasoning": "Analyze the user's intent, available context (products, orders), and decide the best response strategy.",
  "messages": [
    {"type": "text", "text": "Your greeting or general message"},
    {"type": "image", "text": "Product Name - Retail ₹X, Wholesale ₹Y (Pack of Z): URL", "imageUrl": "image_url_from_products", "productName": "Product Name"},
    {"type": "text", "text": "Browse more: category_url"}
  ]
}

RULES:
1. "reasoning": Briefly explain your plan (e.g., "User asked for cases. Found 5 matches. Showing top 2 and category link.")
2. "messages": Array of response objects.
3. "type": "image" PREFERRED for products. "text" for general info.
4. For "image" type: MUST include 'imageUrl' and 'productName'.
5. For "text" type: You can include Links. Links in text messages will generate previews.
6. Maximum 3-4 messages total.
7. CRITICAL: IF "MATCHING PRODUCTS" is found, ONLY use those. If "NO EXACT MATCH", say so, and optionally offer "TOP PRODUCTS" as generic suggestions.
8. QUANTITY: Show MAXIMUM 3 best matching products as images. Do not spam. If more matches exist, mention "Browse all matches here: [Link]" in the final text message.
9. INTELLIGENCE: Only send images if they clearly match the user's intent. If user asks "Do you have S24?", answer "Yes/No" text first, then show images if Yes.
10. HISTORY: Check the HISTORY context. If you already sent a specific product recently, DO NOT send it again unless the user asks for it again. Avoid repetition.
11. PRECISION: If user asks for "iPhone 16", do NOT show "16 Pro" unless you clarify it's an alternative. Be specific.
12. BROAD QUERIES: If user asks broadly (e.g., "covers", "samsung cases") without a specific model, DO NOT send images immediately. Ask "Which model?" first. Avoid guessing.

EXAMPLES:

Query: "Hi"
Response: {
  "reasoning": "User is greeting. I should greet back and offer help.",
  "messages": [{"type": "text", "text": "Welcome to D2BCart! How can I help you find mobile accessories today?"}]
}

Query: "Show me cases"
Response: {
  "reasoning": "Found 10 matches. Showing top 2 and category link to avoid spam.",
  "messages": [
    {"type": "image", "text": "X-LEVEL LEATHER CASE...", "imageUrl": "...", "productName": "..."},
    {"type": "image", "text": "Another Case...", "imageUrl": "...", "productName": "..."},
    {"type": "text", "text": "We have 8 more cases available. Browse all: https://d2bcart.com/products?category=cases-covers"}
  ]
}

IMPORTANT: Return ONLY valid JSON object. No markdown.`
            },
            { role: "user", content: message }
        ]
    });

    const fullResponse = response.choices[0].message.content || "[]";

    try {
        // Parse JSON response
        const cleanJson = fullResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        console.log('[AI Thinking]:', parsed.reasoning); // Log the thinking

        if (parsed.messages && Array.isArray(parsed.messages)) {
            return parsed.messages.map((msg: any) => ({
                type: msg.type || 'text',
                text: msg.text || '',
                imageUrl: msg.imageUrl,
                productName: msg.productName
            }));
        }
    } catch (e) {
        console.error('[AI] Failed to parse JSON response. raw:', fullResponse, 'error:', e);
    }

    // Fallback to text-only
    return [{ type: 'text', text: fullResponse.slice(0, 300) }];
}
