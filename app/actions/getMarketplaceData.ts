'use server'

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

            // 2. Use the "Global Trending" Algorithm (RPC)
            // This ranks products by Views + Orders + Time Spent across ALL users
            const { data: rankedProducts, error: rpcError } = await supabaseAdmin
                .rpc('get_ranked_products', {
                    target_category_id: null, // All Categories
                    limit_count: 60,
                    offset_count: 0
                })

            let finalProducts: Product[] = []

            // Check if RPC failed OR returned no results (Cold Start Problem)
            if (rpcError || !rankedProducts || rankedProducts.length === 0) {
                if (rpcError) console.warn('Recommendation RPC Error (Will fallback):', rpcError)
                else console.log('Recommendation Algorithm returned 0 results (Cold Start). Falling back to "Newest".')

                // FALLBACK: Fetch Newest Products directly
                const { data: fallbackProducts, error: fallbackError } = await supabaseAdmin
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
                    .limit(24)

                if (fallbackError) {
                    console.error('Fallback Product Fetch Error:', fallbackError)
                    // At fewest, return categories if products fail entirely
                    return { categories: favoritesFirst(categories), products: [] }
                }

                finalProducts = (fallbackProducts as Product[]) || []
            } else {
                // HAPPY PATH: RPC Succeeded

                // 3. Fetch Full Details for these Ranked Products
                const productIds = rankedProducts.map((p: any) => p.id)

                const { data: fullProducts, error: fetchError } = await supabaseAdmin
                    .from('products')
                    .select(`
                        *,
                        manufacturer:users!products_manufacturer_id_fkey(is_verified, business_name),
                        category:categories!products_category_id_fkey(name, slug),
                        variations:products!parent_id(display_price, moq)
                    `)
                    .in('id', productIds)

                if (fetchError) {
                    console.error('Product Details Fetch Error:', fetchError)
                    // Don't fail completely, try to return what we have or empty
                    return { categories: favoritesFirst(categories), products: [] }
                }

                // 4. Re-sort to match the Algorithm's Rank
                const sortedProducts = productIds
                    .map((id: string) => fullProducts.find(p => p.id === id))
                    .filter(Boolean) as Product[]

                finalProducts = sortedProducts.filter(p => !p.parent_id)
            }

            return {
                categories: favoritesFirst(categories),
                products: finalProducts.slice(0, 24)
            }
        } catch (error) {
            console.error('Server Action Error:', error)
            return { categories: [], products: [] }
        }
    },
    ['marketplace-data-v10'], // Bump version
    {
        revalidate: 300, // Cache for 5 minutes
        tags: ['marketplace', 'products']
    }
)

export async function loadMoreProducts(page: number = 1) {
    const PAGE_SIZE = 20
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
        console.log(`[loadMoreProducts] Fetching page ${page} (range ${from}-${to})`)

        const { data: products, error } = await supabaseAdmin
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
            .range(from, to)

        // Log parameters and result count to file
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'public', 'debug_log.txt');
            const logMsg = `${new Date().toISOString()} - Page: ${page}, Range: ${from}-${to}, Found: ${products?.length || 0}, Error: ${error ? JSON.stringify(error) : 'None'}\n`;
            fs.appendFileSync(logPath, logMsg);
        } catch (e) { }

        if (error) {
            console.error('[loadMoreProducts] DB Error:', error)
            throw error
        }

        console.log(`[loadMoreProducts] Successfully fetched ${products?.length} products`)
        return { products: products as Product[] }
    } catch (error) {
        console.error('Error loading more products:', error)
        // Log to file for visibility
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'public', 'debug_log.txt');
            fs.appendFileSync(logPath, `${new Date().toISOString()} - loadMoreProducts Error: ${JSON.stringify(error)}\n`);
        } catch (e) { }
        return { products: [] }
    }
}

// Helper to put popular categories first (optional)
function favoritesFirst(categories: Category[]) {
    // We could prioritize specific categories here if needed
    // For now, just return as is or sort by name
    return categories
}
