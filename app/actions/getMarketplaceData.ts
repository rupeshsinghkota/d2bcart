'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'

export async function getMarketplaceData() {
    try {
        // Fetch Categories
        const { data: categories, error: catError } = await supabaseAdmin
            .from('categories')
            .select('*')
            .is('parent_id', null)

        if (catError) console.error('Error fetching categories:', catError)

        // Fetch Products with Manufacturer
        const { data: products, error: prodError } = await supabaseAdmin
            .from('products')
            .select(`
                *,
                manufacturer:users!products_manufacturer_id_fkey(is_verified, business_name),
                category:categories!products_category_id_fkey(name, slug)
            `)
            .eq('is_active', true)
            .limit(10)

        if (prodError) console.error('Error fetching products:', prodError)

        return {
            categories: (categories as Category[]) || [],
            products: (products as Product[]) || []
        }
    } catch (error) {
        console.error('Server Action Error:', error)
        return { categories: [], products: [] }
    }
}
