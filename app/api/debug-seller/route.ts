
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' })

    // Test the complex query used in the page
    const { data: complexProducts, error: complexError } = await supabaseAdmin
        .from('products')
        .select(`
            *,
            manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
            category:categories!products_category_id_fkey(
                name, 
                slug,
                parent_category:categories!categories_parent_id_fkey(name, slug)
            )
        `)
        .eq('manufacturer_id', id)
        .eq('is_active', true)

    // Also fetch the user to verify ID matches
    const { data: user } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

    return NextResponse.json({
        seller: user,
        productCount: complexProducts?.length,
        products: complexProducts,
        error: complexError
    })
}
