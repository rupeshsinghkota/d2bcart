
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

export interface AIResponse {
    reasoning: string;
    escalate?: boolean;
    messages: AIMessage[];
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
                .select('id, parent_id, name, slug, display_price, moq, stock, images, manufacturer:manufacturer_id!inner(is_verified)')
                .ilike('name', `%${keyword}%`)
                .eq('is_active', true)
                .gt('stock', 0)
                .not('images', 'is', null) // Must have images
                .eq('manufacturer.is_verified', true)
                .limit(40); // Increased limit to allow for deduplication filter

            if (data) {
                for (const p of data) {
                    if (!p.images || p.images.length === 0) continue; // Safety skip
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

    // Grouping / Deduplication Logic: One best match per product family
    const uniqueGroups = new Map<string, any>();
    for (const p of sorted) {
        const groupId = p.parent_id || p.id;
        if (!uniqueGroups.has(groupId)) {
            uniqueGroups.set(groupId, p);
        }
        if (uniqueGroups.size >= 10) break;
    }

    return [...uniqueGroups.values()];
}

// Search products by exact slug (for shared links)
async function getProductBySlug(slug: string) {
    const { data } = await getSupabase()
        .from('products')
        .select('id, name, slug, display_price, is_active, stock, images')
        .eq('slug', slug)
        .maybeSingle();
    return data;
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
        .select('name, slug, display_price, images, manufacturer:manufacturer_id!inner(is_verified)')
        .eq('is_active', true)
        .is('parent_id', null) // Match Website: Parents Only
        .gt('stock', 0)
        .eq('manufacturer.is_verified', true)
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
}): Promise<{ messages: AIMessage[], escalate: boolean, reasoning: string }> {
    const { message, phone } = params;

    // Extract slug if message contains a product URL
    const slugMatch = message.match(/products\/([^/?\s]+)/);
    const slug = slugMatch ? slugMatch[1] : null;

    // Parallelize detailed context fetching
    const [customer, categories, matchingProducts, topProducts, history, targetedProduct] = await Promise.all([
        getCustomer(phone),
        getCategories(),
        searchProducts(message),
        getTopProducts(),
        getChatHistory(null, phone),
        slug ? getProductBySlug(slug) : null
    ]);

    // Fetch orders only if customer exists
    const orders = customer ? await getCustomerOrders(customer.id) : [];

    const categoryContext = categories.map((c: any) =>
        `• ${c.name}: https://d2bcart.com/products?category=${c.slug}`
    ).join('\n');

    const productContext = matchingProducts.length > 0
        ? matchingProducts.map((p: any) =>
            `• ${p.name} | Price: ₹${p.display_price} | MOQ: ${p.moq || 1} | Stock: ${p.stock || 'Available'} | Image: ${p.images?.[0] || 'none'} | URL: https://d2bcart.com/products/${p.slug}`
        ).join('\n')
        : '';

    const topProductContext = topProducts.map((p: any) =>
        `• ${p.name} - ₹${p.display_price} | Image: ${p.images?.[0] || 'none'}: https://d2bcart.com/products/${p.slug}`
    ).join('\n');

    let targetedProductContext = '';
    if (targetedProduct) {
        const status = !targetedProduct.is_active ? 'DEACTIVATED' : (targetedProduct.stock <= 0 ? 'OUT OF STOCK' : 'AVAILABLE');
        targetedProductContext = `TARGETED PRODUCT (User shared link):
• ${targetedProduct.name} | Status: ${status} | Price: ₹${targetedProduct.display_price} | URL: https://d2bcart.com/products/${targetedProduct.slug}`;
    }

    let customerContext = "NEW VISITOR";
    if (customer) {
        customerContext = `CUSTOMER: ${customer.business_name || 'Retailer'}, Member since ${new Date(customer.created_at).toLocaleDateString()}`;
        if (orders.length > 0) {
            customerContext += `\nORDERS:\n` + orders.map((o: any) =>
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
${targetedProductContext ? `\n${targetedProductContext}\n` : ''}
${productContext ? `MATCHING PRODUCTS:\n${productContext}` : 'NO EXACT MATCH'}

TOP PRODUCTS:
${topProductContext}

${customerContext}

${historyContext}

RESPONSE FORMAT (CRITICAL):
You must respond in a JSON object with a reasoning field and a messages array:

{
  "reasoning": "Analyze the user's intent, available context (products, orders), and decide the best response strategy.",
  "escalate": false,
  "messages": [
    {"type": "text", "text": "Your greeting or general message"},
    {"type": "image", "text": "Product Name - ₹X (Pack of Z): URL", "imageUrl": "image_url_from_products", "productName": "Product Name"},
    {"type": "text", "text": "Browse all Mobile Accessories: https://d2bcart.com/products"}
  ]
}

RULES:
1. "reasoning": Briefly explain your plan (e.g., "User asked for cases. Found specific matches. Showing top 2 items + category link for more.")
2. "messages": Array of response objects.
3. "type": "image" PREFERRED for specific product searches. "text" for categories and general info.
4. For "image" type: MUST include 'imageUrl', 'productName'. 
   - CRITICAL: The 'text' field MUST contain the Product Name, Price, and the full Product URL.
5. For "text" type: You can include Links. Links in text messages will generate previews.
6. EXTREMELY CONCISE: Maximum 2 short sentences per text message. No professional fluff or filler.
7. CRITICAL: IF "MATCHING PRODUCTS" is found and the query is SPECIFIC (e.g. "iPhone 15 Case"), use those.
8. BROAD QUERIES / CATEGORIES: If user mentions a category name (e.g., "Covers", "Tempered Glass", "Accessories") or asks generically ("What do you have?"), DO NOT send images immediately. Instead, send a "text" message greeting them and providing the Category Name and its Link from the "CATEGORIES" list.
9. QUANTITY: Show MAXIMUM 2 products as images only if intent is specific. For broad intent, show 0 images and provide category links.
10. INTELLIGENCE: Distinguish between 'Search' (specific model) and 'Browse' (category/general). Browse intent = Text + Category Link. Search intent = Images + Product URL.
11. HISTORY: Check the HISTORY context. If you already sent a specific product OR a welcome message recently, DO NOT send it again. 
12. REPETITION: If the user sends the same intent/question multiple times in a row, acknowledge it (e.g., "As mentioned...") and offer human escalation or highlight a DIFFERENT category.
13. HELP REQUESTS: If the user says "I need help with this page" for https://d2bcart.com/products, DO NOT just say "Welcome". Instead, say "You're viewing our full wholesale catalog. Are you looking for something specific like iPhone cases, chargers, or tempered glass? Or would you like to see our newest arrivals?"
14. PRECISION: If user asks for "iPhone 16", do NOT show "16 Pro" unless you clarify it's an alternative.
15. EMERGENCY: If user asks for "Human", "Support", "Emergency" or "Call me", set "escalate": true. Tell the user "I have notified Chandan/Support team. They will contact you shortly." 
    - CRITICAL: DO NOT share the Admin/Support phone number with the user. Keep it private.
16. DEACTIVATED: If a product is unavailable, explain this immediately. Never hallucinate links.
17. TARGETED LINK HANDLING: If the user shared a direct link (Targeted Product), acknowledge that specific item first.

EXAMPLES (STRICTLY CONCISE):

Query: "Hi"
Response: {
  "reasoning": "Simple greeting.",
  "messages": [{"type": "text", "text": "Welcome to D2BCart! How can I help you find mobile accessories today?"}]
}

Query: "Show me cases"
Response: {
  "reasoning": "Broad category.",
  "messages": [
    {"type": "text", "text": "Browse all our covers and cases here: https://d2bcart.com/products?category=cases-covers"}
  ]
}

Query: "iPhone 15 Case"
Response: {
  "reasoning": "Specific model search.",
  "messages": [
    {"type": "image", "text": "iPhone 15 X-LEVEL CASE - ₹X...", "imageUrl": "...", "productName": "..."},
    {"type": "text", "text": "More iPhone 15 items: https://d2bcart.com/products?q=iphone+15"}
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
        const parsed: AIResponse = JSON.parse(cleanJson);

        console.log('[AI Thinking]:', parsed.reasoning); // Log the thinking

        let escalate = parsed.escalate || false;

        // FAILSAVE: If AI says it "notified Chandan/Support", force escalate to true
        const fullText = parsed.messages.map((m: any) => m.text).join(' ').toLowerCase();
        if (fullText.includes('notified chandan') || fullText.includes('support team') || fullText.includes('contact you shortly')) {
            console.log('[AI Failsafe] Triggering escalation based on response text keywords.');
            escalate = true;
        }

        return {
            messages: parsed.messages.map((msg: any) => ({
                type: msg.type || 'text',
                text: msg.text || '',
                imageUrl: msg.imageUrl,
                productName: msg.productName
            })),
            escalate: escalate,
            reasoning: parsed.reasoning || ""
        };
    } catch (e) {
        console.error('[AI] Failed to parse JSON response. raw:', fullResponse, 'error:', e);
    }

    // Fallback to text-only
    return {
        messages: [{ type: 'text', text: fullResponse.slice(0, 300) }],
        escalate: false,
        reasoning: "Failed to parse JSON"
    };
}
