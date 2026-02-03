
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
async function searchProducts(query: string) {
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    let products: any[] = [];

    for (const keyword of keywords) {
        const { data } = await getSupabase()
            .from('products')
            .select('id, name, slug, base_price, display_price, moq, stock, images')
            .ilike('name', `%${keyword}%`)
            .eq('is_active', true)
            .limit(5);
        if (data && data.length > 0) products.push(...data);
    }

    if (products.length === 0) {
        const { data } = await getSupabase()
            .from('products')
            .select('id, name, slug, base_price, display_price, moq, stock, images')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(5);
        if (data) products = data;
    }

    const unique = [...new Map(products.map(p => [p.id, p])).values()];
    return unique.slice(0, 10);
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

export async function getSalesAssistantResponse(params: {
    message: string,
    phone: string,
}): Promise<AIMessage[]> {
    const { message, phone } = params;

    const customer = await getCustomer(phone);
    const orders = customer ? await getCustomerOrders(customer.id) : [];
    const categories = await getCategories();
    const matchingProducts = await searchProducts(message);
    const topProducts = await getTopProducts();

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
2. Use "type": "image" ONLY when recommending specific products where you have an imageUrl.
3. Use "type": "text" for greetings, order status, general answers.
4. Keep text under 300 chars.
5. For greetings like "Hi", "Hello" - respond with text only.
6. Maximum 3-4 messages total.

EXAMPLES:

Query: "Hi"
Response: {
  "reasoning": "User is greeting. I should greet back and offer help.",
  "messages": [{"type": "text", "text": "Welcome to D2BCart! How can I help you find mobile accessories today?"}]
}

Query: "Show me cases"
Response: {
  "reasoning": "User wants cases. I found matching products. I will show 2 structured image messages and a category link.",
  "messages": [
    {"type": "image", "text": "X-LEVEL LEATHER CASE - Redmi Mi A3 - Retail ₹46, Wholesale ₹35 (Pack of 10): https://d2bcart.com/products/...", "imageUrl": "https://...product-image.jpg", "productName": "X-LEVEL LEATHER CASE"},
    {"type": "text", "text": "Browse more cases: https://d2bcart.com/products?category=cases-covers"}
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
        console.error('[AI] Failed to parse JSON response:', fullResponse);
    }

    // Fallback to text-only
    return [{ type: 'text', text: fullResponse.slice(0, 300) }];
}
