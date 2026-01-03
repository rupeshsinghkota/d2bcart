import { createClient } from '@/lib/supabase-server'
import { Product, Category } from '@/types'
import { unstable_cache } from 'next/cache'

export const getShopData = unstable_cache(
    async (categoryId?: string) => {
        try {
            const supabase = await createClient()
            console.log('Fetching shop data from DB...', categoryId || 'all')

            // 1. Fetch all categories for hierarchy
            const { data: allCategories, error: catFetchError } = await supabase
                .from('categories')
                .select('*')
                .order('name')

            if (catFetchError) {
                console.error('Error fetching categories:', catFetchError)
                return { categories: [], products: [] }
            }

            // 2. Fetch active products to determine valid categories
            const { data: activeLinkages, error: prodErr } = await supabase
                .from('products')
                .select('category_id')
                .eq('is_active', true)
                .not('category_id', 'is', null)

            if (prodErr) {
                console.error('Error fetching active linkages:', prodErr)
                return { categories: [], products: [] }
            }

            const activeIds = new Set(activeLinkages?.map(p => p.category_id))

            const hasActiveDescendant = (catId: string): boolean => {
                if (activeIds.has(catId)) return true
                const children = allCategories.filter(c => c.parent_id === catId)
                return children.some(child => hasActiveDescendant(child.id))
            }

            const validCategories = (allCategories as Category[]).filter(cat => hasActiveDescendant(cat.id))

            // 3. Fetch Products
            let query = supabase
                .from('products')
                .select(`
                    *,
                    manufacturer:users!manufacturer_id(business_name, city, is_verified),
                    category:categories!products_category_id_fkey(name, slug)
                `)
                .eq('is_active', true)
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

            const { data: products, error: productsError } = await query

            if (productsError) {
                console.error('Error fetching products:', productsError)
                return { categories: validCategories, products: [] }
            }

            return {
                categories: validCategories,
                products: (products as Product[]) || []
            }
        } catch (error) {
            console.error('Server Action Error (Shop):', error)
            return { categories: [], products: [] }
        }
    },
    ['shop-data'],
    {
        revalidate: 1800, // 30 minutes
        tags: ['shop', 'products', 'categories']
    }
)
