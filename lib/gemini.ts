
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

// Get customer details by phone
async function getCustomer(phone: string) {
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    const last10 = cleanPhone.slice(-10);

    // Try multiple phone formats
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

// Search products
async function searchProducts(query: string) {
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    let products: any[] = [];

    for (const keyword of keywords) {
        const { data } = await getSupabase()
            .from('products')
            .select('id, name, slug, retail_price, wholesale_price')
            .ilike('name', `%${keyword}%`)
            .eq('is_active', true)
            .limit(5);
        if (data) products.push(...data);
    }

    const unique = [...new Map(products.map(p => [p.id, p])).values()];
    return unique.slice(0, 10);
}

// Get all categories
async function getCategories() {
    const { data } = await getSupabase().from('categories').select('id, name, slug').limit(30);
    return data || [];
}

// Get top products
async function getTopProducts() {
    const { data } = await getSupabase()
        .from('products')
        .select('name, slug, retail_price')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
    return data || [];
}

export async function getSalesAssistantResponse(params: {
    message: string,
    phone: string,
}): Promise<string[]> {
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
            `• ${p.name} - ₹${p.retail_price}: https://d2bcart.com/products/${p.slug}`
        ).join('\n')
        : '';

    const topProductContext = topProducts.map(p =>
        `• ${p.name} - ₹${p.retail_price}: https://d2bcart.com/products/${p.slug}`
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
        max_tokens: 400,
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

RULES:
1. NO newlines - plain text only
2. Keep under 300 chars per message
3. Use ---SPLIT--- for multiple messages
4. Include full product URLs when mentioning products
5. For orders, show status from ORDERS above
6. Be helpful and concise`
            },
            { role: "user", content: message }
        ]
    });

    const fullResponse = response.choices[0].message.content || "Sorry, please try again.";
    const messages = fullResponse.split('---SPLIT---').map(m => m.trim()).filter(m => m.length > 0);
    return messages.length > 0 ? messages : [fullResponse];
}
