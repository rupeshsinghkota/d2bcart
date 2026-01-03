import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'
import { unstable_cache } from 'next/cache'

export const getShopData = unstable_cache(
    async (categoryId?: string, page: number = 1, limit: number = 20) => {
        try {
            console.log('Fetching shop data from DB...', { categoryId: categoryId || 'all', page, limit })

            // Calculate range
            const from = (page - 1) * limit
            const to = from + limit - 1

            // 1. Fetch all categories for hierarchy
            const { data: allCategories, error: catFetchError } = await supabaseAdmin
                .from('categories')
                .select('*')
                .order('name')

            if (catFetchError) {
                console.error('Error fetching categories:', catFetchError)
                return { categories: [], products: [], totalProducts: 0 }
            }

            // 2. Fetch active products to determine valid categories
            const { data: activeLinkages, error: prodErr } = await supabaseAdmin
                .from('products')
                .select('category_id')
                .eq('is_active', true)
                .not('category_id', 'is', null)

            if (prodErr) {
                console.error('Error fetching active linkages:', prodErr)
                return { categories: [], products: [], totalProducts: 0 }
            }

            const activeIds = new Set(activeLinkages?.map(p => p.category_id))

            const hasActiveDescendant = (catId: string): boolean => {
                if (activeIds.has(catId)) return true
                const children = allCategories.filter(c => c.parent_id === catId)
                return children.some(child => hasActiveDescendant(child.id))
            }

            const validCategories = (allCategories as Category[]).filter(cat => hasActiveDescendant(cat.id))

            // 3. Fetch Products (exclude variations - only show parent products)
            let query = supabaseAdmin
                .from('products')
                .select(`
                    *,
                    manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                    category:categories!products_category_id_fkey(name, slug)
                `, { count: 'exact' })
                .eq('is_active', true)
                .is('parent_id', null) // Only fetch main products, not variations
                .order('created_at', { ascending: false })

            if (categoryId) {
                const getDescendants = (parentId: string): string[] => {
                    const children = allCategories.filter(c => c.parent_id === parentId)
                    let ids = children.map(c => c.id)
                    children.forEach(child => {
                        ids = [...ids, ...getDescendants(child.id)]
                    })
                    return ids
                }
                const targetIds = [categoryId, ...getDescendants(categoryId)]
                query = query.in('category_id', targetIds)
            }

            // Apply Pagination
            query = query.range(from, to)

            const { data: products, error: productsError, count } = await query

            if (productsError) {
                console.error('Error fetching products:', productsError)
                return { categories: allCategories as Category[], products: [], totalProducts: 0 }
            }

            return {
                categories: validCategories,
                products: (products as Product[]) || [],
                totalProducts: count || 0
            }
        } catch (error) {
            console.error('Server Action Error (Shop):', error)
            return { categories: [], products: [], totalProducts: 0 }
        }
    },
    ['shop-data-v2'],
    {
        revalidate: 300, // 5 minutes
        tags: ['shop', 'products', 'categories']
    }
)
