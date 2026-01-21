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
                    }
                },
            },
        }
    )

    // 1. Fetch Product
    const { data: productData, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

    const product = productData as any

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
    let variationUpdateCount = 0
    let debugMessage = 'Init'

    try {
        const OpenAI = require("openai")
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const prompt = `
        You are an E-commerce SEO Expert. Analyze this product title and existing description to generate a better version with COMPREHENSIVE search data.
        
        Input Title: "${product.name}"
        Input Description: "${product.description || ''}"
        
        Instructions:
        1. **Preserve Information**: Do NOT remove any technical details, specs, or unique info from the Input Description.
        2. **Enhance**: Create a professional, HTML-formatted description.
           - Use <h2> for section headers like "Key Features", "Specifications", "Why Buy This".
           - Use <ul><li> for features and specs.
           - Use <p> for paragraphs.
           - NO markdown code blocks (\`\`\`html). Return ONLY the raw HTML string.
        3. **SEO & Search**: Generate EXTENSIVE search terms for maximum findability.
        
        Return a JSON object with strictly these fields:
        "refined_name" (string, SEO optimized, under 60 chars, professional),
        "refined_description" (string, HTML content),
        "brand" (string, guess if not explicit),
        "model" (string, the model/variant identifier),
        "type" (string e.g. "Case", "Charger", "Cover"),
        "keywords" (array of 10-15 UNIQUE search terms including:
           - Primary product type terms (e.g., "phone case", "mobile cover", "back cover")
           - Brand/model names (e.g., "vivo", "samsung", "iphone")
           - Material terms (e.g., "silicone", "plastic", "leather")
           - Color/pattern terms (e.g., "butterfly", "printed", "designer")
           - Common alternative spellings (e.g., "fone", "mobail", "cove")
           - Hindi transliterations if applicable (e.g., "mobile case", "phone ka cover")
           - Related search terms people might use
        ).
        
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

    if (aiName) updatePayload.name = aiName
    if (aiDescription) updatePayload.description = aiDescription

    const { error: updateError } = await (supabase
        .from('products') as any)
        .update(updatePayload)
        .eq('id', productId)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    // 4. Update Variations (Batch AI Processing)
    const { data: variationsData } = await supabase
        .from('products')
        .select('id, name')
        .eq('parent_id', productId)

    const variations = variationsData as any[]

    if (variations && variations.length > 0 && !isFallback && apiKey) {
        console.log('--- Starting Batch Variation Refinement ---')
        console.log('Parent Name:', aiName)
        console.log('Variation Count:', variations.length)

        try {
            const OpenAI = require("openai")
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

            // Process in chunks of 10 to avoid token limits
            const CHUNK_SIZE = 10
            for (let chunkStart = 0; chunkStart < variations.length; chunkStart += CHUNK_SIZE) {
                const chunk = variations.slice(chunkStart, chunkStart + CHUNK_SIZE)
                console.log(`Processing chunk ${Math.floor(chunkStart / CHUNK_SIZE) + 1}: ${chunk.length} variations`)

                const varPrompt = `
                Parent Product: "${aiName}"
                
                Variations to Refine (${chunk.length} items):
                ${chunk.map((v, i) => `${i + 1}. ID: ${v.id}, Name: "${v.name}"`).join('\n')}

                You are an SEO expert. Generate the MOST SEARCHABLE name for each variation.

                Instructions:
                1. "refined_name": The name people ACTUALLY search for (max 25 chars)
                   - Use your knowledge of how people search on e-commerce sites
                   - "1+13T" → "OnePlus 13T" (this is what people type)
                   - "Sam.A06" → "Samsung A06" (expand brands)
                   - "VIVO_Y17S" → "Vivo Y17s" (proper casing)
                   - Keep it SHORT but recognizable
                2. "variant_label": Same as refined_name
                3. "smart_tags": 10-15 search terms people might use including:
                   - Full name ("oneplus 13t")
                   - Abbreviations ("1+ 13t", "op 13t")
                   - Common misspellings ("onplus", "one plus")
                   - Alternative terms ("nord", "flagship")
                   - Hindi phonetic ("वनप्लस" if applicable)
                
                Return JSON with ALL ${chunk.length} variations:
                { "variations": [{ "id": "...", "refined_name": "...", "variant_label": "...", "smart_tags": [...] }] }
                `

                const varCompletion = await openai.chat.completions.create({
                    messages: [{ role: "user", content: varPrompt }],
                    model: "gpt-3.5-turbo",
                    response_format: { type: "json_object" }
                })

                const varContent = varCompletion.choices[0].message.content
                const varResult = JSON.parse(varContent)

                if (varResult.variations && Array.isArray(varResult.variations)) {
                    for (let i = 0; i < varResult.variations.length; i++) {
                        const refinedVar = varResult.variations[i]
                        const targetId = refinedVar.id || (chunk[i] ? chunk[i].id : null)

                        if (!targetId) continue

                        await (supabase.from('products') as any)
                            .update({
                                name: refinedVar.refined_name,
                                smart_tags: refinedVar.smart_tags || [],
                                ai_metadata: {
                                    refined_by: 'openai_gpt_3.5_turbo_batch',
                                    parent_id: productId,
                                    variant_label: refinedVar.variant_label || refinedVar.refined_name || ''
                                }
                            })
                            .eq('id', targetId)
                        variationUpdateCount++
                    }
                }
            }
            debugMessage = `Batch Success: ${variationUpdateCount}/${variations.length}`

        } catch (error: any) {
            console.error('Variation AI Error:', error)
            debugMessage = `Batch Error: ${error.message}`
            // Fallback: Just rename using old logic if AI fails
            if (aiName && aiName !== product.name) {
                const oldName = product.name
                for (const v of variations) {
                    if (v.name.startsWith(oldName)) {
                        const newVarName = v.name.replace(oldName, aiName)
                        await (supabase.from('products') as any).update({ name: newVarName }).eq('id', v.id)
                    }
                }
            }
        }
    } else if (variations && variations.length > 0 && aiName && aiName !== product.name) {
        debugMessage = `Skipped AI: V=${variations.length} FB=${isFallback}`
        const oldName = product.name
        for (const v of variations) {
            if (v.name.startsWith(oldName)) {
                const newVarName = v.name.replace(oldName, aiName)
                await (supabase.from('products') as any).update({ name: newVarName }).eq('id', v.id)
            }
        }
    } else {
        debugMessage = `Skipped: V=${variations?.length} FB=${isFallback} Key=${!!apiKey}`
    }

    if (isFallback) {
        return {
            success: true,
            tags: aiTags,
            warning: 'AI Limit Hit - Generated basic tags.',
            debug: debugMessage
        }
    }

    return {
        success: true,
        tags: aiTags,
        variationUpdateCount,
        debug: debugMessage
    }
}
