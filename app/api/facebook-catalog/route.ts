import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const escapeXml = (unsafe: string) => {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;'
                case '>': return '&gt;'
                case '&': return '&amp;'
                case '\'': return '&apos;'
                case '"': return '&quot;'
            }
            return c
        })
    }
    const cleanCdata = (str: string) => {
        return str.replace(/]]>/g, ']]]]><![CDATA[>') // Escape CDATA closing sequence
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'

        // 1. Get total count to determine concurrency
        const { count } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)

        const totalProducts = count || 0
        const pageSize = 1000
        const totalPages = Math.ceil(totalProducts / pageSize)

        // 2. Fetch all pages in parallel
        const pagePromises = Array.from({ length: totalPages }, (_, i) => {
            const from = i * pageSize
            const to = from + pageSize - 1

            return supabaseAdmin
                .from('products')
                .select(`
                    *,
                    slug,
                    manufacturer:users!products_manufacturer_id_fkey(business_name),
                    category:categories!products_category_id_fkey(name),
                    variations:products!parent_id(display_price, moq)
                `)
                .eq('is_active', true)
                .range(from, to)
        })

        const results = await Promise.all(pagePromises)

        // 3. Flatten results
        let allProducts: any[] = []
        results.forEach(result => {
            if (result.data) {
                allProducts = [...allProducts, ...result.data]
            }
            if (result.error) {
                console.error('Error fetching batch:', result.error)
            }
        })

        // Use cached products just in case mapped
        const products = allProducts

        // Create Map for fast parent lookup (to inherit images)
        const productMap = new Map(products.map(p => [p.id, p]))

        const xmlItems = (products || []).map((product) => {
            // Price Logic: Use self price, or fallback to lowest variation price
            let unitPrice = product.display_price

            if ((!unitPrice || unitPrice === 0) && product.variations && product.variations.length > 0) {
                // Sort variations by price and take the lowest
                const validVariations = product.variations.filter((v: any) => v.display_price > 0)
                if (validVariations.length > 0) {
                    unitPrice = Math.min(...validVariations.map((v: any) => v.display_price))
                }
            }

            // If still no price, skip this product
            if (!unitPrice || unitPrice <= 0) return ''

            // MOQ Logic: Use self MOQ, or fallback to lowest variation MOQ
            let moq = product.moq || 1
            if (moq === 1 && product.variations && product.variations.length > 0) {
                const validVariations = product.variations.filter((v: any) => v.moq > 0)
                if (validVariations.length > 0) {
                    moq = Math.min(...validVariations.map((v: any) => v.moq))
                }
            }

            // B2B Logic: Total Pack Price
            const packPrice = unitPrice * moq

            // Variants handling: Group by Item Group ID
            const itemGroupId = product.parent_id || (product.type === 'variable' ? product.id : '')

            // Parent Lookup/Image Inheritance
            const parent = product.parent_id ? productMap.get(product.parent_id) : null
            const validImages = (product.images && product.images.length > 0)
                ? product.images
                : (parent?.images || [])

            // Attribute Parsing (Color/Material) from Name
            let deepLinkParams = new URLSearchParams()

            if (itemGroupId && product.parent_id) {
                // Deep Linking: Add 'variant' param so frontend can pre-select it
                deepLinkParams.append('variant', product.id)

                // Fallback: If name contains differentiator, it helps user context
                if (product.name) deepLinkParams.append('color', product.name)
            }

            // Title optimization: Name + Bulk Pack info
            const brand = product.manufacturer?.business_name || 'Generic'
            const title = cleanCdata(`${product.name} - Wholesale Bulk Pack (${moq} Units)`)

            // Description
            const description = cleanCdata(product.description || `Wholesale ${product.name} available in bulk from ${brand}.`)

            // Image
            const imageLink = validImages.length > 0 ? validImages[0] : ''

            // Link with Deep Linking params (Prefer Slug)
            // Use &amp; for query params to be super safe even in CDATA
            let link = `${baseUrl}/products/${product.slug || product.id}`
            if (deepLinkParams.toString()) {
                link += `?${deepLinkParams.toString().replace(/&/g, '&amp;')}`
            }

            // XML Safety: CDATA handles ampersands, so we use raw links
            const safeLink = link
            const safeImageLink = imageLink
            const videoLink = product.video_url ? `<g:video_link><![CDATA[${product.video_url}]]></g:video_link>` : ''

            return `
        <item>
            <g:id>${product.id}</g:id>
            <g:title><![CDATA[${title}]]></g:title>
            <g:description><![CDATA[${description}]]></g:description>
            <g:link><![CDATA[${safeLink}]]></g:link>
            <g:image_link><![CDATA[${safeImageLink}]]></g:image_link>
            ${videoLink}
            ${validImages.slice(1, 11).map((img: string) => `<g:additional_image_link><![CDATA[${img}]]></g:additional_image_link>`).join('')}
            <g:brand><![CDATA[${cleanCdata(brand)}]]></g:brand>
            <g:condition>new</g:condition>
            <g:availability>${product.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
            <g:price>${packPrice.toFixed(2)} INR</g:price>
            
            <!-- Facebook / Google Common Fields -->
            <g:google_product_category>1</g:google_product_category>
            
            <!-- B2B Unit Pricing & Shipping -->
            <g:unit_pricing_measure>1 ct</g:unit_pricing_measure>
            <g:unit_pricing_base_measure>${moq} ct</g:unit_pricing_base_measure>
            ${product.weight ? `<g:shipping_weight>${(product.weight * moq).toFixed(2)} kg</g:shipping_weight>` : ''}
            
            <!-- Identifiers -->
            <g:mpn><![CDATA[${product.sku || product.id}]]></g:mpn>
            <g:identifier_exists>${product.sku ? 'yes' : 'no'}</g:identifier_exists>
            
            ${itemGroupId ? `<g:item_group_id><![CDATA[${itemGroupId}]]></g:item_group_id>` : ''}
            ${product.category?.name ? `<g:product_type><![CDATA[${product.category.name}]]></g:product_type>` : ''}
            
            <!-- Custom Labels for Filtering in Facebook Ads Manager -->
            <g:custom_label_0>Wholesale</g:custom_label_0>
            <g:custom_label_1>${moq > 1 ? 'Bulk' : 'Single'}</g:custom_label_1>
            <g:custom_label_2>${brand}</g:custom_label_2>
        </item>`
        })

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
        <title>D2BCart Facebook Data Feed</title>
        <link>${baseUrl}</link>
        <description>D2BCart Wholesale Product Feed for Facebook Ads</description>
        ${xmlItems.join('')}
    </channel>
</rss>`

        return new NextResponse(rss, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate',
            },
        })
    } catch (e) {
        console.error('Feed generation exception:', e)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
