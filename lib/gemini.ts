
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

// Get customer's recent orders
async function getCustomerOrders(userId: string) {
    const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('retailer_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
    return data || [];
}

// Get customer's cart
async function getCustomerCart(userId: string) {
    const { data } = await supabase
        .from('cart_items')
        .select('quantity, products(name, retail_price)')
        .eq('carts.user_id', userId)
        .limit(5);
    return data || [];
}

// Search products
async function searchProducts(query: string) {
    const { data } = await supabase
        .from('products')
        .select('id, name, slug, retail_price, categories(name, slug)')
        .ilike('name', `%${query}%`)
        .eq('is_active', true)
        .limit(5);
    return data || [];
}

// Get all categories
async function getCategories() {
    const { data } = await supabase
        .from('categories')
        .select('id, name, slug')
        .limit(20);
    return data || [];
}

export async function getSalesAssistantResponse(params: {
    message: string,
    phone: string,
    history?: any[]
}) {
    const { message, phone } = params;

    // Fetch customer context
    const customer = await getCustomer(phone);
    const orders = customer ? await getCustomerOrders(customer.id) : [];
    const categories = await getCategories();
    const products = await searchProducts(message);

    // Build context
    const categoryList = categories.map(c => `${c.name}: https://d2bcart.com/products?category=${c.slug}`).join('\n');
    const productList = products.map(p => `${p.name} (₹${p.retail_price}): https://d2bcart.com/products/${p.slug}`).join('\n');

    let customerContext = "NEW VISITOR (Not registered)";
    if (customer) {
        customerContext = `CUSTOMER: ${customer.business_name || 'Retailer'}
Type: ${customer.user_type}
Member Since: ${new Date(customer.created_at).toLocaleDateString()}`;

        if (orders.length > 0) {
            customerContext += `\nRECENT ORDERS:\n`;
            orders.forEach(o => {
                customerContext += `- #${o.order_number}: ₹${o.total_amount} (${o.status})\n`;
            });
        }
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [
            {
                role: "system",
                content: `You are D2BCart AI Sales Assistant for mobile accessories B2B wholesale platform.

ABOUT D2BCART:
- B2B wholesale platform for mobile accessories
- Products: Cases, Covers, Screen Guards, Chargers, Cables, Earphones, Power Banks
- Users: Retailers buy from Wholesalers
- Website: https://d2bcart.com
- Features: Browse Products, Place Orders, Track Orders, Download Catalogs

${customerContext}

REAL CATEGORIES:
${categoryList}

${products.length > 0 ? `MATCHING PRODUCTS:\n${productList}` : ''}

RULES:
1. Be concise (2-3 sentences for WhatsApp)
2. Use customer's name if known
3. Reference their order history when relevant
4. Include real URLs from catalog above
5. For order status: Provide order number and status
6. If they ask to track order, show their recent orders above`
            },
            {
                role: "user",
                content: message
            }
        ]
    });

    return response.choices[0].message.content || "Sorry, please try again.";
}
