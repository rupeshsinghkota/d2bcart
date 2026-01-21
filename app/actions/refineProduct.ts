"use server"

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function refineProduct(productId: string) {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )

    // 1. Fetch Product
    const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

    if (fetchError || !product) {
        return { success: false, error: 'Product not found' }
    }

    // 2. AI Refinement (OpenAI)
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        return { success: false, error: 'OpenAI API Key not configured' }
    }

    let aiTags: string[] = []
    let aiMetadata: any = {}
    let aiName: string | undefined
    let aiDescription: string | undefined
    let isFallback = false

    try {
        const OpenAI = require("openai")
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const prompt = `
        You are an E-commerce SEO Expert. Analyze this product title and existing description to generate a better version.
        
        Input Title: "${(product as any).name}"
        Input Description: "${(product as any).description || ''}"
        
        Instructions:
        1. **Preserve Information**: Do NOT remove any technical details, specs, or unique info from the Input Description.
        2. **Enhance**: Create a professional, LONG, HTML-formatted description.
           - Use <h2> for section headers like "Key Features", "Specifications", "Why Buy This", "Product Overview".
           - Use <ul><li> for features and specs.
           - Use <p> for paragraphs.
           - NO markdown code blocks (\`\`\`html).Return ONLY the raw HTML string for the description.
        3. ** SEO **: Optimize the refined_name and refined_description for better search visibility.
        
        Return a JSON object with strictly these fields:
        "refined_name"(string, SEO optimized, capitalized, professional),
            "refined_description"(string, HTML content with <h2>, <p>, <ul>.DO NOT wrap in \`\`\`html),
        "brand" (string, guess if not explicit),
        "model" (string),
        "type" (string e.g. "Case", "Charger"),
        "keywords" (array of 5 seo strings).
        
        Return ONLY valid JSON.
        `

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
            response_format: { type: "json_object" }
        })

        const content = completion.choices[0].message.content
        const aiData = JSON.parse(content)

        aiTags = aiData.keywords || []
        aiName = aiData.refined_name
        aiDescription = aiData.refined_description

        aiMetadata = {
            refined_by: 'openai_gpt_3.5_turbo',
            confidence: 1.0,
            brand: aiData.brand,
            model: aiData.model,
            type: aiData.type,
            raw_ai: aiData
        }
    } catch (error: any) {
        console.error('OpenAI Error:', error)
        // Fallback Logic
        isFallback = true
        aiTags = [
            product.name.split(' ')[0],
            'Mobile Accessory',
            'Best Seller',
            'New Arrival'
        ]
        aiMetadata = {
            refined_by: 'fallback_mock',
            confidence: 0.5,
            note: 'AI Request Failed, using fallback',
            error: error.message
        }
    }

    // 3. Update Product
    const updatePayload: any = {
        smart_tags: aiTags,
        ai_metadata: aiMetadata
    }

    // Only update name/description if AI successfully generated them
    if (aiName) updatePayload.name = aiName
    if (aiDescription) updatePayload.description = aiDescription

    const { error: updateError } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', productId)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    if (isFallback) {
        return { success: true, tags: aiTags, warning: 'AI Limit Hit - Generated basic tags.' }
    }

    return { success: true, tags: aiTags }
}
