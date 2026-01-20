'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product, Category } from '@/types'
import { unstable_cache } from 'next/cache'

// Cached Categories Fetcher (Longer Cache: 1 Hour)
const SYNONYMS: Record<string, string[]> = {
    'cover': ['case', 'backcover', 'protection'],
    'case': ['cover', 'backcover', 'protection'],
    'glass': ['tempered', 'guard', 'screen'],
    'tempered': ['glass', 'guard', 'screen'],
    'cable': ['wire', 'cord', 'charger'],
    'charger': ['adapter', 'dock', 'cable'],
    'stand': ['holder', 'mount'],
    'holder': ['stand', 'mount'],
    'earphone': ['headset', 'headphones', 'buds', 'airpods'],
    'buds': ['earphone', 'headset', 'airpods'],
};

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
// Cached Products Fetcher (Shorter Cache: 5 mins)
// Cached Products Fetcher (Shorter Cache: 5 mins)
// export const getShopProducts = unstable_cache(
export const getShopProducts = async (categoryId?: string, page: number = 1, limit: number = 20, searchQuery: string = '') => {
    try {
        console.log('Fetching shop products...', { categoryId, page, searchQuery })
        const from = (page - 1) * limit
        const to = from + limit - 1

        // Need all categories to find descendants if filtering by category
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

        // Search filter - Using Postgres Full Text Search with Prefix Matching (Partial Support)
        if (searchQuery) {
            // "Sam Cov" -> "Sam:* & Cov:*"
            const sanitized = searchQuery.trim().replace(/[|&!:()]/g, '').split(/\s+/).filter(w => w.length > 0)
            if (sanitized.length > 0) {
                const formattedQuery = sanitized.map(w => `${w}:*`).join(' & ')
                query = query.textSearch('search_vector', formattedQuery, {
                    config: 'english'
                })
            }
        }

        if (categoryId && targetIds.length > 0) {
            query = query.in('category_id', targetIds)
        }

        query = query.range(from, to)

        const { data: products, error, count } = await query

        if (error) {
            console.error('Supabase Query Error:', error)
            return { products: [], totalProducts: 0 }
        }

        // Fallback: If FTS returned no results, try simple ILIKE on strict name match
        // This fixes cases like "1+" where FTS might strip the "+" symbol
        if ((!products || products.length === 0) && searchQuery) {
            const fallbackQuery = supabaseAdmin
                .from('products')
                .select(`
                    *,
                    manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                    category:categories!products_category_id_fkey(name, slug),
                    variations:products!parent_id(display_price, moq)
                `, { count: 'exact' })
                .eq('is_active', true)
                .is('parent_id', null)
                .ilike('name', `%${searchQuery}%`)
                .order('created_at', { ascending: false })
                .range(from, to)

            const { data: fallbackProducts, count: fallbackCount } = await fallbackQuery

            if (fallbackProducts && fallbackProducts.length > 0) {
                return {
                    products: (fallbackProducts as Product[]) || [],
                    totalProducts: fallbackCount || 0
                }
            }
        }

        return {
            products: (products as Product[]) || [],
            totalProducts: count || 0
        }
    } catch (error) {
        console.error('Error fetching products:', error)
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'public', 'debug_log.txt');
            fs.appendFileSync(logPath, `${new Date().toISOString()} - Catch Error: ${JSON.stringify(error)}\n`);
        } catch (e) { }
        return { products: [], totalProducts: 0 }
    }
}
// ['shop-products-v2'], // Bump version for search param change
// { revalidate: 300, tags: ['products'] }
// )

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
    sortBy: string = 'recommended',
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

        // Search filter - Using Postgres Full Text Search (Robust & Fast)
        // Search filter - Using Postgres Full Text Search with Prefix Matching (Partial Support)
        if (searchQuery) {
            // Cleaning and formatting the query for Full Text Search
            const cleanedQuery = searchQuery
                .replace(/[!&|():*]/g, ' ') // Remove special chars that break tsquery
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .join(' & ') // Join words with AND operator

            // 1. Expand Synonyms
            // const expandedQuery = expandSearchQuery(searchQuery); // This was from the example, but we'll build it directly for prefixing

            // 2. Format for Prefix Matching (Standard FTS)
            // We convert "Samsung Cover" -> "Samsung:* & (Cover | Case | ...):*"
            // Note: expandSearchQuery returns "(word | syn)" format. We need to handle the prefixing carefully.
            // Simplified approach: Just stick adjacent to the OR groups logic.

            // Actually, let's refine expandSearchQuery to handle the formatting ready for textSearch
            // Re-implementing inside the flow for clarity:

            const terms = searchQuery.trim().split(/\s+/);
            const tsParts = terms.map(term => {
                const clean = term.toLowerCase().replace(/[^a-z0-9]/g, '');
                const syns = SYNONYMS[clean];
                if (syns) {
                    // (term | syn1 | syn2):*
                    return `(${term} | ${syns.join(' | ')}):*`;
                }
                return `${term}:*`;
            });
            const finalTsQuery = tsParts.join(' & ');

            query = query.textSearch('search_vector', finalTsQuery, {
                config: 'english'
            })
        }

        // Category filter
        if (categoryId && targetIds.length > 0) {
            query = query.in('category_id', targetIds)
        }

        // Sorting
        // 1. Recommended (Algorithm)
        if (sortBy === 'recommended') {
            const { data: rankedProducts, error: rpcError } = await supabaseAdmin
                .rpc('get_ranked_products', {
                    target_category_id: categoryId || null,
                    limit_count: limit,
                    offset_count: from
                })

            if (rpcError) {
                console.error('Recommendation Engine Error:', rpcError)
                // Fallback to newest if RPC fails
                query = query.order('created_at', { ascending: false })
            } else {
                // Fetch full details for ranked products if needed, or structured returns
                // The RPC returns most fields, but we need relations like manufacturer/category
                // Since RPC returns are simpler, we might just use the RPC result directly 
                // IF we updated the RPC to return joined JSON. 
                // For now, let's assume RPC returns compatible basic fields, but complex relations might needed.
                // STRATEGY B: Get IDs from RPC and fetch full objects to match `Product` type perfectly.

                const productIds = rankedProducts.map((p: any) => p.id)

                if (productIds.length > 0) {
                    const { data: fullProducts, error: fetchError } = await supabaseAdmin
                        .from('products')
                        .select(`
                            *,
                            manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                            category:categories!products_category_id_fkey(name, slug),
                            variations:products!parent_id(display_price, moq)
                        `)
                        .in('id', productIds)

                    if (!fetchError && fullProducts) {
                        // Re-sort to match RPC order (Important!)
                        const sortedFullProducts = productIds
                            .map((id: string) => fullProducts.find(p => p.id === id))
                            .filter(Boolean) as Product[]

                        return {
                            products: sortedFullProducts,
                            totalProducts: 100 // Estimate for infinite scroll or fetch count separately
                        }
                    }
                }
            }
        }

        // 2. Standard Sorting
        switch (sortBy) {
            case 'price_asc':
                query = query.order('display_price', { ascending: true })
                break
            case 'price_desc':
                query = query.order('display_price', { ascending: false })
                break
            case 'newest':
                query = query.order('created_at', { ascending: false })
                break
            case 'default':
            default:
                // If fell through to default but wasn't explicitly 'newest' or 'price',
                // AND it wasn't 'recommended' (which is handled above), 
                // Then treat as 'recommended' if we want it strictly everywhere?
                // Actually, the client defaults 'recommended' now, so logic above runs.
                // But for pure fail-safe, if someone sends empty sort, we should probably run algo?
                // Let's keep 'newest' as the technical fallback for "unknown string" to avoid recursion complexity, 
                // since 'recommended' block is separate.

                // However, let's make sure the param default is 'recommended'
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
