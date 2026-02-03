
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get customer details by phone
async function getCustomer(phone: string) {
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    const { data } = await supabase
        .from('users')
        .select('id, business_name, phone, user_type, created_at')
        .or(`phone.eq.${cleanPhone},phone.eq.91${cleanPhone.slice(-10)}`)
        .single();
    return data;
}

// Get customer's recent orders with items
async function getCustomerOrders(userId: string) {
    const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, tracking_number')
        .eq('retailer_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
    return data || [];
}

// Search products - return full details with URLs
async function searchProducts(query: string) {
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    let products: any[] = [];

    for (const keyword of keywords) {
        const { data } = await supabase
            .from('products')
            .select('id, name, slug, retail_price, wholesale_price, categories(name, slug)')
            .ilike('name', `%${keyword}%`)
            .eq('is_active', true)
            .limit(5);
        if (data) products.push(...data);
    }

    // Remove duplicates
    const unique = [...new Map(products.map(p => [p.id, p])).values()];
    return unique.slice(0, 10);
}

// Get all categories
async function getCategories() {
    const { data } = await supabase.from('categories').select('id, name, slug').limit(30);
    return data || [];
}

// Get top selling products
async function getTopProducts() {
    const { data } = await supabase
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
    history?: any[]
}): Promise<string[]> {
    const { message, phone } = params;

    // Fetch ALL context
    const customer = await getCustomer(phone);
    const orders = customer ? await getCustomerOrders(customer.id) : [];
    const categories = await getCategories();
    const matchingProducts = await searchProducts(message);
    const topProducts = await getTopProducts();

    // Build category context
    const categoryContext = categories.map(c =>
        `• ${c.name}: https://d2bcart.com/products?category=${c.slug}`
    ).join('\n');

    // Build matching products context with FULL URLs
    const productContext = matchingProducts.length > 0
        ? matchingProducts.map(p =>
            `• ${p.name} - ₹${p.retail_price} (Wholesale: ₹${p.wholesale_price})\n  URL: https://d2bcart.com/products/${p.slug}`
        ).join('\n')
        : '';

    // Build top products context
    const topProductContext = topProducts.map(p =>
        `• ${p.name} - ₹${p.retail_price}: https://d2bcart.com/products/${p.slug}`
    ).join('\n');

    // Customer context
    let customerContext = "NEW VISITOR";
    if (customer) {
        customerContext = `KNOWN CUSTOMER:
Name: ${customer.business_name || 'Retailer'}
Type: ${customer.user_type}
Member Since: ${new Date(customer.created_at).toLocaleDateString()}`;
        if (orders.length > 0) {
            customerContext += `\n\nRECENT ORDERS:`;
            orders.forEach(o => {
                customerContext += `\n• #${o.order_number}: ₹${o.total_amount} - Status: ${o.status}${o.tracking_number ? ` - Tracking: ${o.tracking_number}` : ''}`;
            });
        }
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
            {
                role: "system",
                content: `You are D2BCart AI Sales Assistant - a smart WhatsApp bot for B2B mobile accessories wholesale.

=== ABOUT D2BCART ===
• B2B wholesale platform for mobile accessories
• Products: Cases, Covers, Screen Guards, Chargers, Cables, Earphones, Power Banks, Holders
• Website: https://d2bcart.com
• How it works: Retailers browse → Add to Cart → Place Order → Track Delivery

=== WEBSITE PAGES ===
• Home: https://d2bcart.com
• All Products: https://d2bcart.com/products
• Cart: https://d2bcart.com/cart
• Orders: https://d2bcart.com/orders
• Login: https://d2bcart.com/login

=== ALL CATEGORIES ===
${categoryContext}

${productContext ? `=== MATCHING PRODUCTS (from search) ===\n${productContext}` : ''}

=== TOP/NEW PRODUCTS ===
${topProductContext}

=== CUSTOMER CONTEXT ===
${customerContext}

=== RESPONSE RULES ===
1. NO NEWLINES OR MARKDOWN - Write everything in plain text, single paragraph
2. Use "---SPLIT---" to break into multiple messages (each under 300 chars)
3. ALWAYS include the FULL product URL (https://d2bcart.com/products/SLUG)
4. Use customer's name if known
5. Be helpful and concise
6. For multiple products, send each as a separate message using ---SPLIT---`
            },
            {
                role: "user",
                content: message
            }
        ]
    });

    const fullResponse = response.choices[0].message.content || "Sorry, please try again.";

    // Split into multiple messages if needed
    const messages = fullResponse.split('---SPLIT---').map(m => m.trim()).filter(m => m.length > 0);

    return messages.length > 0 ? messages : [fullResponse];
}
