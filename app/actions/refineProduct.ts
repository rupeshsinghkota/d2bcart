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

    // 2. Fetch Variations (Moved UP for Context)
    const { data: variationsData } = await supabase
        .from('products')
        .select('id, name')
        .eq('parent_id', productId)

    const variations = variationsData as any[] || []

    // 3. AI Refinement (OpenAI)
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

        // Prepare context for AI
        const variantNames = variations.map(v => v.name).slice(0, 50).join(', ') // send first 50 names
        const totalVariants = variations.length
        const price = product.display_price

        const prompt = `
        You are an E-commerce Content Expert. Generate an EXTREMELY EXTENSIVE, DEEP-DIVE HTML product description (Target: 2000-3000 words).
        
        Input Name: "${product.name}"
        Input Description: "${product.description || ''}"
        Price: ₹${price}
        Total Variations: ${totalVariants} (Examples: ${variantNames}...)
        
        Instructions:
        1. **MANDATORY**: You MUST preserve EVERY single technical detail, dimension, and spec from the Input Description.
        
        2. **Create a Massive, Encyclopedia-Style HTML Description**:
           - Use <h2> for main sections and <h3> for subsections.
           - **Introduction**: 3-4 paragraphs hooking the reader.
           - **Detailed Feature Analysis**: dedicating a full paragraph to EACH feature.
           - **Material & Durability Deep Dive**: Explain the science/quality of the material.
           - **Usage & Lifestyle**: How this product improves daily life (3-4 paragraphs).
           - **Installation / Usage Guide**: Step-by-step instructions.
           - **Care & Maintenance**: How to clean/maintain it.
           - **Comparison**: Why this is better than generic alternatives.
           - **FAQ Section**: Generate 10+ common questions and detailed answers.
           - **Compatibility**: Mention the extensive range (${totalVariants}+ models).
           - **Why Buy**: A persuasive closing manifesto.
           - **Compatibility Placeholder**: <div id="compatibility-placeholder"></div>
        
        3. **Style**: authoritative, trustworthy, and exhaustive. Write like a comprehensive review.
        
        4. **Refine Name**: Create a clean, SEO-friendly parent product name.
        
        5. **SEO Keywords**: Generate 30+ high-value keywords.

        Return JSON:
        {
            "refined_name": "...", 
            "refined_description": "<div class='product-desc'><h2>In-Depth Review</h2>...</div>",
            "brand": "...",
            "model": "...",
            "type": "...",
            "keywords": ["...", "..."]
        }
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
    // CRITICAL: Append the original description to ensure NO DATA LOSS
    let finalDescription = aiDescription;
    if (product.description && !isFallback && aiDescription) {
        finalDescription = `
            ${aiDescription}
            <br><hr>
            <div vocab="https://schema.org/" typeof="Product">
                <h2>Original Specifications / Details</h2>
                <div property="description">
                    ${product.description.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
    }

    const updatePayload: any = {
        smart_tags: aiTags,
        ai_metadata: aiMetadata
    }

    if (aiName) updatePayload.name = aiName
    if (finalDescription) updatePayload.description = finalDescription

    // Fallback if AI description is missing/failed but we have name update
    if (!finalDescription && aiDescription) updatePayload.description = aiDescription

    const { error: updateError } = await (supabase
        .from('products') as any)
        .update(updatePayload)
        .eq('id', productId)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    // 4. Update Variations (Batch AI Processing)
    // Variations already fetched above
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
                   - **CRITICAL**: Do NOT use abbreviations for brands. EXPAND them.
                   - NO "1+13", NO "Ip 14", NO "Sam S23".
                   - YES "OnePlus 13", YES "iPhone 14", YES "Samsung S23".
                   - Capitalize properly (Vivo, Oppo, Realme).
                   - Keep the model name prominent.
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

            // After processing all variations, aggregate their names to parent for searchability
            if (variationUpdateCount > 0) {
                // Fetch updated variation names
                const { data: updatedVars } = await supabase
                    .from('products')
                    .select('name, ai_metadata')
                    .eq('parent_id', productId)

                if (updatedVars && updatedVars.length > 0) {
                    const varNames = updatedVars.map((v: any) => v.name || v.ai_metadata?.variant_label).filter(Boolean)
                    const uniqueVarNames = [...new Set(varNames)]

                    // Create "Compatible Models" text for description
                    const compatibleModelsHtml = `<h2>Compatible Models</h2><p>${uniqueVarNames.join(', ')}</p>`

                    // Add variation names to parent's smart_tags for searchability
                    const varTags = uniqueVarNames.flatMap((name: string) => {
                        // Split model names into searchable parts
                        return [name.toLowerCase(), ...name.toLowerCase().split(' ').filter((p: string) => p.length > 2)]
                    })
                    const mergedTags = [...new Set([...(aiTags || []), ...varTags])]

                    // Update parent with enhanced description and tags
                    await (supabase.from('products') as any)
                        .update({
                            description: (aiDescription || '') + compatibleModelsHtml,
                            smart_tags: mergedTags.slice(0, 30) // Limit to 30 tags
                        })
                        .eq('id', productId)

                    console.log(`Added ${uniqueVarNames.length} variation names to parent search`)
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
