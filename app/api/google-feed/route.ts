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
                manufacturer:users!products_manufacturer_id_fkey(business_name),
                category:categories!products_category_id_fkey(name)
            `)
            .eq('is_active', true)
            .not('display_price', 'is', null)

        if (error) {
            console.error('Error fetching products for feed:', error)
            return new NextResponse('Error generating feed', { status: 500 })
        }

        const xmlItems = (products || []).map((product) => {
            // B2B Logic: Total Pack Price
            // Feed Price = Unit Price * MOQ
            // This ensures the price shown in ads matches the minimum amount a user must pay
            const unitPrice = product.display_price || 0
            const moq = product.moq || 1
            const packPrice = unitPrice * moq

            // Variants handling
            // If it's a variation, use parent_id as item_group_id
            // If it's a parent, use its own id as item_group_id (or leave empty if simple product)
            const itemGroupId = product.parent_id || (product.type === 'variable' ? product.id : '')

            // Title optimization: Brand + Name + Bulk Pack info
            const brand = product.manufacturer?.business_name || 'Generic'
            const title = `${brand} ${product.name} - Wholesale Bulk Pack (${moq} Units)`

            // Description
            const description = product.description || `Wholesale ${product.name} available in bulk from ${brand}.`

            // Image
            const imageLink = product.images && product.images.length > 0 ? product.images[0] : ''

            // Link
            let link = `${baseUrl}/products/${product.id}`
            // Add any other params if needed for variants, though ID usually suffices

            return `
        <item>
            <g:id>${product.id}</g:id>
            <g:title><![CDATA[${title}]]></g:title>
            <g:description><![CDATA[${description}]]></g:description>
            <g:link>${link}</g:link>
            <g:image_link>${imageLink}</g:image_link>
            <g:brand><![CDATA[${brand}]]></g:brand>
            <g:condition>new</g:condition>
            <g:availability>${product.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
            <g:price>${packPrice.toFixed(2)} INR</g:price>
            
            <!-- B2B Unit Pricing Attributes -->
            <g:unit_pricing_measure>1 ct</g:unit_pricing_measure>
            <g:unit_pricing_base_measure>${moq} ct</g:unit_pricing_base_measure>
            
            <!-- Identifiers -->
            <g:mpn>${product.sku || product.id}</g:mpn>
            <g:identifier_exists>${product.sku ? 'yes' : 'no'}</g:identifier_exists>
            
            ${itemGroupId ? `<g:item_group_id>${itemGroupId}</g:item_group_id>` : ''}
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
