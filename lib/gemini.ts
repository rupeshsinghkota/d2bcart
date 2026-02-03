
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Search products in database
async function searchProducts(query: string) {
    const { data } = await supabase
        .from('products')
        .select('id, name, slug, retail_price, category_id, categories(name, slug)')
        .ilike('name', `%${query}%`)
        .eq('is_active', true)
        .limit(3);
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
    history?: any[],
    context?: string
}) {
    const { message } = params;

    // Fetch real data from DB
    const categories = await getCategories();
    const products = await searchProducts(message);

    const categoryList = categories.map(c => `${c.name}: https://d2bcart.com/products?category=${c.slug}`).join('\n');
    const productList = products.map(p => `${p.name} (₹${p.retail_price}): https://d2bcart.com/products/${p.slug}`).join('\n');

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 150,
        messages: [
            {
                role: "system",
                content: `You are D2BCart AI Sales Assistant for mobile accessories B2B platform.
Be concise (2-3 sentences max for WhatsApp).

REAL CATEGORIES:
${categoryList}

${products.length > 0 ? `MATCHING PRODUCTS:\n${productList}` : ''}

ALWAYS include the actual product/category URL from above when relevant. Website: https://d2bcart.com`
            },
            {
                role: "user",
                content: message
            }
        ]
    });

    return response.choices[0].message.content || "Sorry, please try again.";
}
