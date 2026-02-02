import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'

        // Fetch all active products with manufacturer and category details
        // We use supabaseAdmin to bypass RLS and get all products
        const { data: products, error } = await supabaseAdmin
            .from('products')
            .select(`
                *,
                slug,
                manufacturer:users!products_manufacturer_id_fkey(business_name),
                category:categories!products_category_id_fkey(name),
                variations:products!parent_id(display_price, moq)
            `)
            .eq('is_active', true)
            .range(0, 9999)

        if (error) {
            console.error('Error fetching products for feed:', error)
            return new NextResponse('Error generating feed', { status: 500 })
        }

        const xmlItems = (products || []).map((product) => {
            // B2B Logic: Total Pack Price
            // B2B Logic: Total Pack Price
            // Feed Price = Unit Price * MOQ
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

            let moq = product.moq || 1
            if (moq === 1 && product.variations && product.variations.length > 0) {
                const validVariations = product.variations.filter((v: any) => v.moq > 0)
                if (validVariations.length > 0) {
                    moq = Math.min(...validVariations.map((v: any) => v.moq))
                }
            }

            const packPrice = unitPrice * moq

            // Variants handling: Group by Item Group ID
            const itemGroupId = product.parent_id || (product.type === 'variable' ? product.id : '')

            // Attribute Parsing (Color/Material) from Name
            let deepLinkParams = new URLSearchParams()

            if (itemGroupId && product.parent_id) {
                // Deep Linking: Add 'variant' param so frontend can pre-select it
                deepLinkParams.append('variant', product.id)

                // Fallback: If name contains differentiator, it helps user context
                if (product.name) deepLinkParams.append('color', product.name)
            }

            // Title optimization: Name + Bulk Pack info
            // Ensure unique titles for variants
            const brand = product.manufacturer?.business_name || 'Generic'
            const title = `${product.name} - Wholesale Bulk Pack (${moq} Units)`

            // Description
            const description = product.description || `Wholesale ${product.name} available in bulk from ${brand}.`

            // Image
            const imageLink = product.images && product.images.length > 0 ? product.images[0] : ''

            // Link with Deep Linking params (Prefer Slug)
            let link = `${baseUrl}/products/${product.slug || product.id}`
            if (deepLinkParams.toString()) {
                link += `?${deepLinkParams.toString()}`
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
            <g:brand><![CDATA[${brand}]]></g:brand>
            <g:condition>new</g:condition>
            <g:availability>${product.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
            <g:price>${packPrice.toFixed(2)} INR</g:price>
            
            <!-- B2B Unit Pricing & Shipping -->
            <g:unit_pricing_measure>1 ct</g:unit_pricing_measure>
            <g:unit_pricing_base_measure>${moq} ct</g:unit_pricing_base_measure>
            ${product.weight ? `<g:shipping_weight>${(product.weight * moq).toFixed(2)} kg</g:shipping_weight>` : ''}
            
            <!-- Identifiers -->
            <g:mpn><![CDATA[${product.sku || product.id}]]></g:mpn>
            <g:identifier_exists>${product.sku ? 'yes' : 'no'}</g:identifier_exists>
            
            ${itemGroupId ? `<g:item_group_id><![CDATA[${itemGroupId}]]></g:item_group_id>` : ''}
            ${product.category?.name ? `<g:product_type><![CDATA[${product.category.name}]]></g:product_type>` : ''}
        </item>`
        })

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
        <title>D2BCart Wholesale Feed</title>
        <link>${baseUrl}</link>
        <description>B2B Product Feed for Google Merchant Center</description>
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
