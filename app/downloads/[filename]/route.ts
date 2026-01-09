
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { generateAndUploadCatalog } from '@/lib/catalog/generator'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    const { filename } = await context.params
    // filename might be a SLUG (e.g. 'mobiles') or an ID or 'catalog_slug.pdf'

    // Clean up filename (remove .pdf prefix/suffix if present from old logic)
    let identifier = filename.replace(/^catalog_/, '').replace(/\.pdf$/, '')

    const supabase = await createClient()

    // 1. Resolve Identifier to Category ID
    let categoryId = identifier

    // Check if it's a UUID (Length 36? Regex?)
    // Easier: Try to find by UUID first, if fail/invalid, try slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)

    let category = null

    if (isUuid) {
        const { data } = await supabase.from('categories').select('id, name').eq('id', identifier).single()
        category = data
    }

    if (!category) {
        // Try Slug
        const { data } = await supabase.from('categories').select('id, name').eq('slug', identifier).single()
        category = data
    }

    if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // 2. Use Existing Generator Logic
    try {
        const publicUrl = await generateAndUploadCatalog(category.id, supabase)

        if (publicUrl) {
            return NextResponse.redirect(publicUrl)
        } else {
            return NextResponse.json({ error: 'Failed to generate catalog PDF' }, { status: 500 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
