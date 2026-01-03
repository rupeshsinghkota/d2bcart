import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'
import { unstable_cache } from 'next/cache'

export const getMarketplaceData = unstable_cache(
    async () => {
        try {
            console.log('Fetching marketplace data from DB...')
            // Fetch Categories
            const { data: activeProductCategories, error: prodCatError } = await supabaseAdmin
                .from('products')
                .select('category_id')
                .eq('is_active', true)

            if (prodCatError) console.error('Error fetching active product categories:', prodCatError)

            const uniqueActiveCategoryIds = Array.from(new Set(activeProductCategories?.map(p => p.category_id).filter(Boolean) || []))

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
                .filter(c => c.parent_id === null)
                .filter(c => hasActiveDescendant(c.id))

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
    },
    ['marketplace-data'],
    {
        revalidate: 1800, // Cache for 30 minutes
        tags: ['marketplace']
    }
)
