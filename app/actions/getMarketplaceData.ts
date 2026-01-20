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
                .limit(60) // Increased to 60 to get a mix of categories (Holders, Cables, etc.)

            // Redundant filter to be 100% sure variations are excluded
            let filteredProducts = (products as Product[] || []).filter(p => !p.parent_id)

            // Randomize the feed (Fisher-Yates Shuffle)
            // This prevents "Newest" (e.g. 20 Holders) from dominating the feed
            for (let i = filteredProducts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [filteredProducts[i], filteredProducts[j]] = [filteredProducts[j], filteredProducts[i]];
            }

            if (prodError) console.error('Error fetching products:', prodError)

            return {
                categories: favoritesFirst(categories),
                products: filteredProducts.slice(0, 24) // Return top 24 after shuffle
            }
        } catch (error) {
            console.error('Server Action Error:', error)
            return { categories: [], products: [] }
        }
    },
    ['marketplace-data-v7'],
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
