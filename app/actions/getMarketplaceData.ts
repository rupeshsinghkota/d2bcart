import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'
import { unstable_cache } from 'next/cache'
import { getShopCategories } from './getShopData'

export const getMarketplaceData = unstable_cache(
    async () => {
        try {
            console.log('Fetching marketplace data from DB...')

            // 1. Reuse the robust, cached category fetcher
            const categories = await getShopCategories()

            // 2. Fetch a small batch of initial products
            const { data: products, error: prodError } = await supabaseAdmin
                .from('products')
                .select(`
                    *,
                    manufacturer:users!products_manufacturer_id_fkey(is_verified, business_name),
                    category:categories!products_category_id_fkey(name, slug),
                    variations:products!parent_id(display_price, moq)
                `)
                .eq('is_active', true)
                .is('parent_id', null)
                .order('created_at', { ascending: false })
                .limit(20) // Increased to 20 to match page size

            // Redundant filter to be 100% sure variations are excluded
            const filteredProducts = (products as Product[] || []).filter(p => !p.parent_id)

            if (prodError) console.error('Error fetching products:', prodError)

            return {
                categories: favoritesFirst(categories),
                products: filteredProducts
            }
        } catch (error) {
            console.error('Server Action Error:', error)
            return { categories: [], products: [] }
        }
    },
    ['marketplace-data-v6'],
    {
        revalidate: 300, // Cache for 5 minutes
        tags: ['marketplace', 'products']
    }
)

// Helper to put popular categories first (optional)
function favoritesFirst(categories: Category[]) {
    // We could prioritize specific categories here if needed
    // For now, just return as is or sort by name
    return categories
}
