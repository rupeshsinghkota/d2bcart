import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'
import { unstable_cache } from 'next/cache'

export const getMarketplaceData = unstable_cache(
    async () => {
        try {
            console.log('Fetching marketplace data from DB...')
            // Fetch Categories that actually have products
            const { data: activeProductCategories, error: prodCatError } = await supabaseAdmin
                .from('products')
                .select('category_id')
                .eq('is_active', true)
                .not('category_id', 'is', null)

            if (prodCatError) console.error('Error fetching active product categories:', prodCatError)

            const uniqueActiveCategoryIds = Array.from(new Set(activeProductCategories?.map(p => p.category_id) || []))

            const { data: allCategories, error: catFetchError } = await supabaseAdmin
                .from('categories')
                .select('*')

            if (catFetchError) {
                console.error('Error fetching categories:', catFetchError)
                return { categories: [], products: [] }
            }

            const hasActiveDescendant = (catId: string): boolean => {
                if (uniqueActiveCategoryIds.includes(catId)) return true
                const children = allCategories.filter(c => c.parent_id === catId)
                return children.some(child => hasActiveDescendant(child.id))
            }

            const categories = (allCategories as Category[])
                .filter(c => hasActiveDescendant(c.id))

            const { data: products, error: prodError } = await supabaseAdmin
                .from('products')
                .select(`
                    *,
                    manufacturer:users!products_manufacturer_id_fkey(is_verified, business_name),
                    category:categories!products_category_id_fkey(name, slug)
                `)
                .eq('is_active', true)
                .is('parent_id', null)
                .limit(10)

            // Redundant filter to be 100% sure variations are excluded
            const filteredProducts = (products as Product[] || []).filter(p => !p.parent_id)

            if (prodError) console.error('Error fetching products:', prodError)

            return {
                categories: (categories as Category[]) || [],
                products: filteredProducts
            }
        } catch (error) {
            console.error('Server Action Error:', error)
            return { categories: [], products: [] }
        }
    },
    ['marketplace-data-v2'],
    {
        revalidate: 300, // Cache for 5 minutes
        tags: ['marketplace', 'products']
    }
)
