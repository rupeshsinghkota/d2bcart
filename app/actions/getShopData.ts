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

// New Instant Search Action for "Top 1%" Experience
export async function getInstantSearchResults(query: string) {
    try {
        if (!query || query.trim().length < 2) return { products: [], categories: [], brands: [] }

        // 1. Search Products (Standard Match)
        // Fetch more items to allow for deduplication
        const { data: rawProducts, error: prodError } = await supabaseAdmin
            .from('products')
            .select('id, name, slug, images, display_price, moq, parent_id')
            .eq('is_active', true)
            .ilike('name', `%${query}%`)
            .limit(15) // Fetch more to filter duplicates
            .order('display_price', { ascending: false });

        // Deduplicate by Parent ID and Name Similarity
        const uniqueProducts: any[] = [];
        const seenKeys = new Set();

        if (rawProducts) {
            for (const p of rawProducts) {
                // 1. Prefer grouping by Parent ID if available
                if (p.parent_id) {
                    if (seenKeys.has(p.parent_id)) continue;
                    seenKeys.add(p.parent_id);
                    uniqueProducts.push(p);
                    continue;
                }

                // 2. If no parent, group by Name Similarity (first 30 chars)
                // This prevents "Product X for S23", "Product X for S24" from clogging results
                const nameKey = p.name.trim().toLowerCase().substring(0, 30);
                if (seenKeys.has(nameKey)) continue;

                seenKeys.add(nameKey);
                uniqueProducts.push(p);

                if (uniqueProducts.length >= 5) break;
            }
        }

        // 2. Search Categories
        const { data: categories, error: catError } = await supabaseAdmin
            .from('categories')
            .select('id, name, slug')
            .ilike('name', `%${query}%`)
            .limit(3)

        // 3. Search Brands (Users)
        const { data: brands, error: brandError } = await supabaseAdmin
            .from('users')
            .select('business_name')
            .eq('user_type', 'manufacturer')
            .ilike('business_name', `%${query}%`)
            .limit(3)

        return {
            products: (uniqueProducts || []) as Product[],
            categories: (categories || []) as Category[],
            brands: (brands?.map(b => b.business_name) || []) as string[]
        }
    } catch (error) {
        console.error('Instant Search Error:', error)
        return { products: [], categories: [], brands: [] }
    }
}

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

        // Search filter - Using Postgres Full Text Search (Robust & Fast)
        if (searchQuery) {
            // Cleaning and formatting the query for Full Text Search
            const cleanQuery = searchQuery.replace(/[!&|():*]/g, ' ').trim()
            const terms = cleanQuery.split(/\s+/).filter(Boolean)

            if (terms.length > 0) {
                // 1. Build TS Query with Synonyms  
                // "nord 5 cover" -> "(nord:* & 5:* & (cover:* | case:* | protection:*))"
                const tsParts = terms.map(term => {
                    const clean = term.toLowerCase().replace(/[^a-z0-9]/g, '')
                    const syns = SYNONYMS[clean]
                    if (syns) {
                        // Each term needs its own :* for prefix matching
                        const allTerms = [term, ...syns].map(t => `${t}:*`).join(' | ')
                        return `(${allTerms})`
                    }
                    return `${term}:*`
                })
                const finalTsQuery = tsParts.join(' & ')

                query = query.textSearch('search_vector', finalTsQuery, {
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

        // Fallback: If FTS returned no results, try aggressive Ranked Partial Search
        // This handles cases like "nord 5" or "oneplus cover" where we want to prioritize
        // products that match MORE words (Relevance Sort).
        if ((!products || products.length === 0) && searchQuery) {
            const cleanQuery = searchQuery.replace(/[!&|():*]/g, ' ').trim()
            const terms = cleanQuery.split(/\s+/).filter(Boolean)

            if (terms.length > 0) {
                // Prepare Query: "term1 | term2 | ..." (Matches ANY)
                // The RPC will handle sorting by how MANY terms match (ts_rank).
                const orQuery = terms.join(' | ')

                const { data: rankedProducts, error: rpcError } = await supabaseAdmin
                    .rpc('search_products_ranked', {
                        search_query: orQuery,
                        limit_count: limit,
                        offset_count: from
                    })

                if (rpcError) {
                    console.error('Ranked Search RPC Error:', rpcError)
                    return { products: [], totalProducts: 0 }
                }

                if (rankedProducts && rankedProducts.length > 0) {
                    const ids = rankedProducts.map((p: any) => p.id)

                    // Fetch full details with relations for these IDs
                    // We must fetch manually because the RPC only returns the product row, 
                    // but our app expects joined relations (manufacturer, category, etc.)
                    const { data: fullProducts } = await supabaseAdmin
                        .from('products')
                        .select(`
                            *,
                            manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                            category:categories!products_category_id_fkey(name, slug),
                            variations:products!parent_id(display_price, moq)
                        `)
                        .in('id', ids)

                    if (fullProducts) {
                        // CRITICAL: Restore the Rank Order!
                        // The .in() query returns results in random order. 
                        // We map our sorted 'ids' list to the fetched objects to preserve relevance.
                        const sortedProducts = ids
                            .map((id: string) => fullProducts.find(p => p.id === id))
                            .filter(Boolean) as Product[]

                        return {
                            products: sortedProducts,
                            totalProducts: sortedProducts.length // Approximate for fallback
                        }
                    }
                }

                // Ultimate fallback: Simple ilike search on name and description
                console.log('Using ilike fallback search for:', searchQuery)
                const { data: ilikeProducts, count: ilikeCount } = await supabaseAdmin
                    .from('products')
                    .select(`
                        *,
                        manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                        category:categories!products_category_id_fkey(name, slug),
                        variations:products!parent_id(display_price, moq)
                    `, { count: 'exact' })
                    .eq('is_active', true)
                    .is('parent_id', null)
                    .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
                    .order('created_at', { ascending: false })
                    .range(from, from + limit - 1)

                if (ilikeProducts && ilikeProducts.length > 0) {
                    return {
                        products: ilikeProducts as Product[],
                        totalProducts: ilikeCount || ilikeProducts.length
                    }
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
                    // Fix: Apply :* to each term individually for correct prefix matching
                    const allTerms = [term, ...syns].map(t => `${t}:*`).join(' | ')
                    return `(${allTerms})`
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

        const { data: initialProducts, error: initialError, count: initialCount } = await query

        if (initialError) throw initialError

        let products = initialProducts
        let count = initialCount

        // Fallback: If FTS returned no results, try aggressive Ranked Partial Search
        // This exact logic mirrors getShopProducts to ensure consistency between first load and pagination
        if ((!products || products.length === 0) && searchQuery) {
            const cleanQuery = searchQuery.replace(/[!&|():*]/g, ' ').trim()
            const terms = cleanQuery.split(/\s+/).filter(Boolean)

            if (terms.length > 0) {
                // Prepare Query: "term1 | term2 | ..." (Matches ANY)
                const orQuery = terms.join(' | ')

                const { data: rankedProducts, error: rpcError } = await supabaseAdmin
                    .rpc('search_products_ranked', {
                        search_query: orQuery,
                        limit_count: limit,
                        offset_count: from
                    })

                if (!rpcError && rankedProducts && rankedProducts.length > 0) {
                    const ids = rankedProducts.map((p: any) => p.id)

                    // Fetch full details with relations
                    const { data: fullProducts } = await supabaseAdmin
                        .from('products')
                        .select(`
                            *,
                            manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                            category:categories!products_category_id_fkey(name, slug),
                            variations:products!parent_id(display_price, moq)
                        `)
                        .in('id', ids)

                    if (fullProducts) {
                        // Restore Rank Order
                        products = ids
                            .map((id: string) => fullProducts.find(p => p.id === id))
                            .filter(Boolean) as any[]

                        count = 100 // Estimate
                    }
                }

                // Ultimate fallback: Simple ilike search on name and description
                if (!products || products.length === 0) {
                    console.log('Using ilike fallback search for:', searchQuery)
                    const { data: ilikeProducts, count: ilikeCount } = await supabaseAdmin
                        .from('products')
                        .select(`
                            *,
                            manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                            category:categories!products_category_id_fkey(name, slug),
                            variations:products!parent_id(display_price, moq)
                        `, { count: 'exact' })
                        .eq('is_active', true)
                        .is('parent_id', null)
                        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
                        .order('created_at', { ascending: false })
                        .range(from, from + limit - 1)

                    if (ilikeProducts && ilikeProducts.length > 0) {
                        products = ilikeProducts
                        count = ilikeCount || ilikeProducts.length
                    }
                }
            }
        }

        return {
            products: (products as Product[]) || [],
            totalProducts: count || 0
        }
    } catch (error) {
        console.error('Error paginating products:', error)
        return { products: [], totalProducts: 0 }
    }
}
