
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { generateAndUploadCatalog } from '@/lib/catalog/generator'
import { sendWhatsAppMessage } from '@/lib/msg91'

export async function POST(request: NextRequest) {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    const parsed = parseCookieHeader(request.headers.get('Cookie') ?? '')
                    return parsed.map(c => ({ name: c.name, value: c.value ?? '' }))
                },
                setAll() { }
            },
        }
    )

    // 1. Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !user.phone) {
        return NextResponse.json({ error: 'Unauthorized or no phone' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { eventType, id, metadata } = body // id is categoryId or productId

        if (!id || !eventType) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        let categoryId = id
        let templateName = ''
        let msgComponents = {}
        let sourcePageValue = ''

        // 2. Logic Router
        if (eventType === 'browse_category') {
            sourcePageValue = 'auto_browse_category'
            categoryId = id

            // TEMPLATE A: Category Browse
            templateName = process.env.MSG91_TEMPLATE_CATEGORY_BROWSE || "d2b_category_browse"
            /* Expected Template Variables:
               - Button 1: Catalog Link
               (If using body params, adjust below)
            */

        } else if (eventType === 'browse_product') {
            sourcePageValue = 'auto_browse_product'
            // We need to fetch the category ID of this product
            const { data: product } = await supabase
                .from('products')
                .select('category_id, name')
                .eq('id', id)
                .single()

            if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
            categoryId = product.category_id

            // TEMPLATE B: Product Browse
            templateName = process.env.MSG91_TEMPLATE_PRODUCT_BROWSE || "d2b_product_browse"
            /* Expected Template Variables:
              - Body 1: Product Name (e.g. "Saw you interested in X")
              - Button 1: Catalog Link
           */
            msgComponents = {
                "body_1": { "type": "text", "value": product.name }
            }
        }

        // 3. Cooldown Check (24h per category per source)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recentLogs } = await supabase
            .from('catalog_downloads')
            .select('id')
            .eq('user_id', user.id)
            .eq('category_id', categoryId)
            // .eq('source_page', sourcePageValue) // Actually, let's limit TOTAL auto-sends per category, regardless of source?
            // Safer to limit by category to avoid spamming same catalog.
            .gt('created_at', twentyFourHoursAgo)
            .ilike('source_page', 'auto_%') // Matches any auto source
            .limit(1)

        if (recentLogs && recentLogs.length > 0) {
            return NextResponse.json({ skipped: true, reason: 'Cooldown active' })
        }

        // 4. Generate Catalog
        const pdfUrl = await generateAndUploadCatalog(categoryId, supabase)
        if (!pdfUrl) return NextResponse.json({ error: 'Failed to generate catalog' }, { status: 500 })

        // 5. Send Message
        // Add Button Component (Assuming both templates use a dynamic URL button for the catalog)
        const finalComponents = {
            ...msgComponents,
            "button_1": {
                "subtype": "url",
                "type": "text",
                "value": `catalog_${categoryId}.pdf` // Sent as variable {{1}} to match https://d2bcart.com/downloads/{{1}}
            }
        }

        const result = await sendWhatsAppMessage({
            mobile: user.phone,
            templateName,
            components: finalComponents
        })

        if (result.success) {
            await supabase.from('catalog_downloads').insert({
                user_id: user.id,
                category_id: categoryId,
                source_page: sourcePageValue
            })
            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ error: 'Msg91 Failed', details: result.error }, { status: 500 })
        }

    } catch (e) {
        console.error('Marketing Event Error', e)
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
    }
}
