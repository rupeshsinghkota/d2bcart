'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'

export async function getMarketplaceData() {
    try {
        // Fetch Categories
        // We only want categories that have at least one active product
        // Since we can't easily do a JOIN filter on the 'categories' query directly with standard supabase-js in one go without a view,
        // we will fetch all categories and a lightweight check for products.
        // Optimization: In a real large scale app, this should be a Database View "active_categories".
        // For now, we will fetch active products first and derive categories, OR fetch categories and check existence.

        // Approach: Fetch active products' category_ids first (lightweight)
        const { data: activeProductCategories, error: prodCatError } = await supabaseAdmin
            .from('products')
            .select('category_id')
            .eq('is_active', true)

        if (prodCatError) console.error('Error fetching active product categories:', prodCatError)

        const uniqueActiveCategoryIds = Array.from(new Set(activeProductCategories?.map(p => p.category_id).filter(Boolean) || []))

        const { data: categories, error: catError } = await supabaseAdmin
            .from('categories')
            .select('*')
            .is('parent_id', null)
            .in('id', uniqueActiveCategoryIds)

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
