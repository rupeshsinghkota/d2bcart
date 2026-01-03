'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculateDisplayPrice, calculateMargin } from '@/lib/utils'
import { revalidateTag } from 'next/cache'

export async function syncCategoryPrices(categoryId: string, markupPercentage: number) {
    try {
        console.log(`Syncing prices for category ${categoryId} with markup ${markupPercentage}%`)

        // 1. Fetch all products in this category
        const { data: products, error: fetchError } = await supabaseAdmin
            .from('products')
            .select('id, base_price')
            .eq('category_id', categoryId)

        if (fetchError) throw fetchError
        if (!products || products.length === 0) return { success: true, count: 0 }

        // 2. Prepare updates
        const updates = products.map(p => {
            const displayPrice = calculateDisplayPrice(Number(p.base_price), markupPercentage)
            const margin = calculateMargin(displayPrice, Number(p.base_price))
            return {
                id: p.id,
                display_price: displayPrice,
                your_margin: margin
            }
        })

        // 3. Batch Update (Supabase-js doesn't have a clean batch update by ID for different values in one call easily without upsert, 
        // but we can loop or use a rpc if it gets too large. For now, looping with Promise.all is okay for moderate sizes).
        // Since it's a B2B platform, categories might have hundreds, not millions.

        const results = await Promise.all(
            updates.map(update =>
                supabaseAdmin
                    .from('products')
                    .update({
                        display_price: update.display_price,
                        your_margin: update.your_margin
                    })
                    .eq('id', update.id)
            )
        )

        const errors = results.filter(r => r.error)
        if (errors.length > 0) {
            console.error('Errors during sync:', errors)
            throw new Error(`Failed to update ${errors.length} products`)
        }

        revalidateTag('products')
        revalidateTag('shop')
        revalidateTag('marketplace')

        return { success: true, count: products.length }
    } catch (error: any) {
        console.error('Sync Error:', error)
        return { success: false, error: error.message }
    }
}
