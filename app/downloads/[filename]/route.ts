
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAndUploadCatalog } from '@/lib/catalog/generator'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    const { filename } = await context.params
    // filename might be a SLUG (e.g. 'mobiles') or an ID or 'catalog_slug.pdf'

    // Clean up filename (remove .pdf prefix/suffix if present from old logic)
    // Make case-insensitive for encryption extension check
    let identifier = filename.replace(/^catalog_/, '').replace(/\.pdf$/i, '')

    // Use Admin Client to ensure we can read products/upload even if guest
    const supabase = supabaseAdmin

    // 1. Resolve Identifier to Category ID
    // FALLBACK: If identifier is just 'catalog' (generic test), pick the first category
    if (identifier.toLowerCase() === 'catalog') {
        const { data } = await supabase.from('categories').select('id, name').limit(1).single()
        if (data) {
            console.log(`[Catalog] 'catalog' requested, defaulting to: ${data.name}`)
            category = data
        }
    }

    // Check if it's a UUID (Length 36? Regex?)
    // Easier: Try to find by UUID first, if fail/invalid, try slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)

    if (!category && isUuid) {
        const { data } = await supabase.from('categories').select('id, name').eq('id', identifier).single()
        category = data
    }

    if (!category) {
        // Try Slug
        const { data } = await supabase.from('categories').select('id, name').eq('slug', identifier).single()
        category = data
    }

    if (!category) {
        return NextResponse.json({ error: 'Category not found', identifier }, { status: 404 })
    }

    // 2. Use Existing Generator Logic
    try {
        console.log(`[Catalog] Generating for Category: ${category.name} (${category.id})`)
        const publicUrl = await generateAndUploadCatalog(category.id, supabase)

        if (publicUrl) {
            return NextResponse.redirect(publicUrl)
        } else {
            console.error('[Catalog] Generator returned null (likely no products or RLS issue)')
            return NextResponse.json({ error: 'Failed to generate catalog PDF: No data returned' }, { status: 500 })
        }
    } catch (error: any) {
        console.error('[Catalog] Generation Exception:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
