
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
    const { data } = await getSupabase()
        .from('users')
        .select('id, business_name, phone, user_type, created_at')
        .or(`phone.eq.${cleanPhone},phone.eq.91${cleanPhone.slice(-10)}`)
        .single();
    return data;
}

// Get customer's recent orders with items
async function getCustomerOrders(userId: string) {
    const { data } = await getSupabase()
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
        const { data } = await getSupabase()
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
    const { data } = await getSupabase().from('categories').select('id, name, slug').limit(30);
    return data || [];
}

// Get top selling products
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
            `• ${p.name} - ₹${p.retail_price} (Wholesale: ₹${p.wholesale_price}) URL: https://d2bcart.com/products/${p.slug}`
        ).join('\n')
        : '';

    // Build top products context
    const topProductContext = topProducts.map(p =>
        `• ${p.name} - ₹${p.retail_price}: https://d2bcart.com/products/${p.slug}`
    ).join('\n');

    // Customer context
    let customerContext = "NEW VISITOR (Not registered yet)";
    if (customer) {
        customerContext = `REGISTERED CUSTOMER:
Name: ${customer.business_name || 'Retailer'}
Type: ${customer.user_type}
Member Since: ${new Date(customer.created_at).toLocaleDateString()}`;
        if (orders.length > 0) {
            customerContext += `\n\nORDER HISTORY:`;
            orders.forEach(o => {
                customerContext += `\n• Order #${o.order_number}: ₹${o.total_amount} - Status: ${o.status}${o.tracking_number ? ` - Tracking: ${o.tracking_number}` : ''}`;
            });
        } else {
            customerContext += `\nNo orders yet.`;
        }
    }

    const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
            {
                role: "system",
                content: `You are "D2B Assistant" - the official AI Sales Assistant for D2BCart, India's B2B wholesale marketplace for mobile accessories.

══════════════════════════════════════
ABOUT D2BCART
══════════════════════════════════════
• D2BCart is a B2B wholesale platform where Retailers buy directly from Wholesalers
• Products: Mobile Cases, Covers, Screen Guards, Tempered Glass, Chargers, Cables, Earphones, Power Banks, Mobile Holders, Accessories
• Minimum order: No minimum, but wholesale prices for bulk orders
• Delivery: All over India via courier partners
• Payment: Online (Razorpay) - UPI, Cards, Net Banking
• Returns: Contact support within 7 days for damaged items

══════════════════════════════════════
WEBSITE PAGES
══════════════════════════════════════
• Home: https://d2bcart.com
• All Products: https://d2bcart.com/products
• Cart: https://d2bcart.com/cart
• My Orders: https://d2bcart.com/orders
• Login/Register: https://d2bcart.com/login
• Contact Support: WhatsApp 917557777987

══════════════════════════════════════
ALL CATEGORIES
══════════════════════════════════════
${categoryContext}

══════════════════════════════════════
${productContext ? `MATCHING PRODUCTS (Based on query)\n${productContext}` : 'NO EXACT PRODUCT MATCH - Suggest categories or top products'}

══════════════════════════════════════
TOP/NEW ARRIVALS
══════════════════════════════════════
${topProductContext}

══════════════════════════════════════
CUSTOMER CONTEXT
══════════════════════════════════════
${customerContext}

══════════════════════════════════════
RESPONSE RULES (CRITICAL)
══════════════════════════════════════

1. FORMAT:
   - NO newlines, NO markdown, NO bullets - plain text only
   - Keep each message under 300 characters
   - Use ---SPLIT--- to break into multiple messages
   - Example: "First message here ---SPLIT--- Second message here"

2. PRODUCT QUERIES (MOST IMPORTANT):
   - If MATCHING PRODUCTS section has products, you MUST use those exact URLs
   - Format: "Check out [Product Name] - ₹[Price]: https://d2bcart.com/products/[slug]"
   - ONLY use category URLs if NO products are found in MATCHING PRODUCTS
   - Send each product as a separate message using ---SPLIT---
   - Example: "Samsung S22 Ultra MagSafe Case - ₹299: https://d2bcart.com/products/samsung-s22-ultra-magsafe-case"

3. ORDER QUERIES:
   - If customer asks "where is my order", show their order status from ORDER HISTORY above
   - Include order number, status, and tracking number if available
   - If no orders found, say "You don't have any orders yet. Browse products at https://d2bcart.com/products"

4. GREETING:
   - Use customer's business name if known: "Hi [Business Name]!"
   - For new visitors: "Welcome to D2BCart!"

5. PRICING QUERIES:
   - Always mention both retail and wholesale prices when available
   - Encourage bulk orders for better rates

6. REGISTRATION/LOGIN:
   - Direct to https://d2bcart.com/login
   - Mention benefits: "Register to get wholesale prices and track orders"

7. COMPLAINTS/ISSUES:
   - Apologize sincerely
   - Ask for order number
   - Offer to connect with support: "Our team will help. WhatsApp us at 917557777987"

8. OUT OF STOCK / NOT FOUND:
   - Suggest similar category
   - Offer to notify when available
   - Share top products as alternatives

9. TONE:
   - Professional but friendly
   - Helpful and solution-oriented
   - Never argue, always accommodate
   - Use emojis sparingly (max 1 per message)

10. ESCALATION:
    - For complex issues, pricing negotiations, or complaints: "Let me connect you with our team. Please WhatsApp 917557777987"

══════════════════════════════════════
EXAMPLE RESPONSES
══════════════════════════════════════

Query: "iPhone 15 case"
Response: "Hi! Check out iPhone 15 cases here: https://d2bcart.com/products?category=cases-covers - We have premium cases starting ₹99!"

Query: "Where is my order?"
Response: "Hi [Name]! Your order #12345 is currently Shipped. Track it here: [tracking link] ---SPLIT--- Need help? WhatsApp us at 917557777987"

Query: "Do you deliver to Delhi?"
Response: "Yes! We deliver all across India including Delhi. Orders are shipped within 24-48 hours. Browse products: https://d2bcart.com/products"

Query: "Price of charger"
Response: "We have chargers starting from ₹49 (wholesale). Check our full range: https://d2bcart.com/products?category=chargers"`
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
