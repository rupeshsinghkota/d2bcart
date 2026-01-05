'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'
import { unstable_cache } from 'next/cache'

// Cached Categories Fetcher (Longer Cache: 1 Hour)
export const getShopCategories = unstable_cache(
    async () => {
        try {
            console.log('Fetching shop categories...')

            // 1. Fetch all categories
            const { data: allCategories, error: catFetchError } = await supabaseAdmin
                .from('categories')
                .select('*')
                .order('name')

            if (catFetchError) throw catFetchError

            // 2. Fetch active product linkages
            const { data: activeLinkages, error: prodErr } = await supabaseAdmin
                .from('categories')
                .select('id, products!inner(id)')
                .eq('products.is_active', true)

            if (prodErr) throw prodErr

            const activeIds = new Set(activeLinkages?.map(c => c.id))

            const hasActiveDescendant = (catId: string): boolean => {
                if (activeIds.has(catId)) return true
                const children = (allCategories as Category[]).filter(c => c.parent_id === catId)
                return children.some(child => hasActiveDescendant(child.id))
            }

            const validCategories = (allCategories as Category[]).filter(cat => hasActiveDescendant(cat.id))

            return validCategories
        } catch (error) {
            console.error('Error fetching categories:', error)
            return []
        }
    },
    ['shop-categories-v1'],
    { revalidate: 3600, tags: ['categories'] }
)

// Cached Products Fetcher (Shorter Cache: 5 mins)
export const getShopProducts = unstable_cache(
    async (categoryId?: string, page: number = 1, limit: number = 20) => {
        try {
            console.log('Fetching shop products...', { categoryId, page })
            const from = (page - 1) * limit
            const to = from + limit - 1

            // Need all categories to find descendants if filtering by category
            // We can fetch this cheaply or pass it in, but ideally we fetch strictly from DB
            // To be safe and fast, let's fetch just ids for hierarchy if needed
            let targetIds: string[] = []
            if (categoryId) {
                const { data: allCats } = await supabaseAdmin.from('categories').select('id, parent_id')
                if (allCats) {
                    const getDescendants = (pid: string): string[] => {
                        const children = allCats.filter(c => c.parent_id === pid)
                        let ids = children.map(c => c.id)
                        children.forEach(child => ids.push(...getDescendants(child.id)))
                        return ids
                    }
                    targetIds = [categoryId, ...getDescendants(categoryId)]
                } else {
                    targetIds = [categoryId]
                }
            }

            let query = supabaseAdmin
                .from('products')
                .select(`
                    *,
                    manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                    category:categories!products_category_id_fkey(name, slug),
                    variations:products!parent_id(display_price, moq)
                `, { count: 'exact' })
                .eq('is_active', true)
                .is('parent_id', null)
                .order('created_at', { ascending: false })

            if (categoryId && targetIds.length > 0) {
                query = query.in('category_id', targetIds)
            }

            query = query.range(from, to)

            const { data: products, error, count } = await query

            if (error) throw error

            return {
                products: (products as Product[]) || [],
                totalProducts: count || 0
            }
        } catch (error) {
            console.error('Error fetching products:', error)
            return { products: [], totalProducts: 0 }
        }
    },
    ['shop-products-v1'], // tags are dynamic based on args in next/cache logic usually, but here key is static + args
    { revalidate: 300, tags: ['products'] }
)

// Legacy compatibility wrapper (but optimized)
export const getShopData = async (categoryId?: string, page: number = 1, limit: number = 20) => {
    const [categories, { products, totalProducts }] = await Promise.all([
        getShopCategories(),
        getShopProducts(categoryId, page, limit)
    ])

    return { categories, products, totalProducts }
}

// Uncached Server Action for Client-Side Pagination (bypasses RLS with admin)
export async function paginateShopProducts(
    categoryId: string | null,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'newest',
    searchQuery: string = ''
) {
    try {
        const from = (page - 1) * limit
        const to = from + limit - 1

        // Build category filter
        let targetIds: string[] = []
        if (categoryId) {
            const { data: allCats } = await supabaseAdmin.from('categories').select('id, parent_id')
            if (allCats) {
                const getDescendants = (pid: string): string[] => {
                    const children = allCats.filter(c => c.parent_id === pid)
                    let ids = children.map(c => c.id)
                    children.forEach(child => ids.push(...getDescendants(child.id)))
                    return ids
                }
                targetIds = [categoryId, ...getDescendants(categoryId)]
            } else {
                targetIds = [categoryId]
            }
        }

        let query = supabaseAdmin
            .from('products')
            .select(`
                *,
                manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                category:categories!products_category_id_fkey(name, slug),
                variations:products!parent_id(display_price, moq)
            `, { count: 'exact' })
            .eq('is_active', true)
            .is('parent_id', null)

        // Search filter
        if (searchQuery) {
            query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        }

        // Category filter
        if (categoryId && targetIds.length > 0) {
            query = query.in('category_id', targetIds)
        }

        // Sorting
        switch (sortBy) {
            case 'price_asc':
                query = query.order('display_price', { ascending: true })
                break
            case 'price_desc':
                query = query.order('display_price', { ascending: false })
                break
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false })
                break
        }

        query = query.range(from, to)

        const { data: products, error, count } = await query

        if (error) throw error

        return {
            products: (products as Product[]) || [],
            totalProducts: count || 0
        }
    } catch (error) {
        console.error('Error paginating products:', error)
        return { products: [], totalProducts: 0 }
    }
}
