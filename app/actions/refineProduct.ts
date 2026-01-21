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

            const varPrompt = `
            Parent Product: "${aiName}" (Full Product Name)
            
            Variations to Refine:
            ${variations.map((v, i) => `${i + 1}. ID: ${v.id}, Current Name: "${v.name}"`).join('\n')}

            CRITICAL Instructions:
            1. Generate a "refined_name" that is ONLY the model/device identifier:
               - It should be JUST "Vivo X200" or "Samsung M06" - NOT a full product name
               - The parent product already has the full title, so variation name = model only
               - Max 25 characters
               - Examples: "Vivo Y17s", "iPhone 15 Pro", "Realme 14 Pro+", "Samsung A06"
               - BAD: "GTEL Vivo X200 Glass Protector" (too long, repeats parent info)
               - GOOD: "Vivo X200"
            2. "variant_label" should be the same as refined_name (the model identifier)
            3. Generate 8-12 "smart_tags" per variation including:
               - Model name variations (e.g., "vivo x200", "x200", "vivox200")
               - Product type from parent (e.g., "screen protector", "tempered glass")
               - Common misspellings
            
            Return a JSON object:
            {
               "variations": [
                  { "id": "...", "refined_name": "Vivo X200", "variant_label": "Vivo X200", "smart_tags": ["..."] }
               ]
            }
            `
            console.log('Sending Batch Prompt to OpenAI...')

            const varCompletion = await openai.chat.completions.create({
                messages: [{ role: "user", content: varPrompt }],
                model: "gpt-3.5-turbo",
                response_format: { type: "json_object" }
            })

            const varContent = varCompletion.choices[0].message.content
            console.log('Batch AI Response:', varContent)

            const varResult = JSON.parse(varContent)

            if (varResult.variations && Array.isArray(varResult.variations)) {
                for (const refinedVar of varResult.variations) {
                    console.log(`Updating Variation: ${refinedVar.id} -> ${refinedVar.refined_name} (${refinedVar.variant_label})`)
                    await (supabase
                        .from('products') as any)
                        .update({
                            name: refinedVar.refined_name,
                            smart_tags: refinedVar.smart_tags,
                            ai_metadata: {
                                refined_by: 'openai_gpt_3.5_turbo_batch',
                                parent_id: productId,
                                variant_label: refinedVar.variant_label || ''
                            }
                        })
                        .eq('id', refinedVar.id)
                    variationUpdateCount++
                }
            }
            debugMessage = 'Batch Success'

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
