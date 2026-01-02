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

        // Fetch all categories first to build the tree
        const { data: allCategories, error: catFetchError } = await supabaseAdmin
            .from('categories')
            .select('*')

        if (catFetchError) {
            console.error('Error fetching categories:', catFetchError)
            return { categories: [], products: [] }
        }

        // Helper to check if a category or any of its children has active products
        const hasActiveDescendant = (catId: string): boolean => {
            if (uniqueActiveCategoryIds.includes(catId)) return true // Direct product match

            // Check children
            const children = allCategories.filter(c => c.parent_id === catId)
            return children.some(child => hasActiveDescendant(child.id))
        }

        // Filter for top-level categories that are valid
        const categories = (allCategories as Category[])
            .filter(c => c.parent_id === null) // Only top-level for homepage
            .filter(c => hasActiveDescendant(c.id)) // Only valid ones

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
