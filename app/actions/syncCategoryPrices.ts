'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculateDisplayPrice, calculateMargin } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

export async function syncCategoryPrices(categoryId: string, markupPercentage: number) {
    try {
        console.log(`[SYNC] Syncing prices for category ${categoryId} with markup ${markupPercentage}%`)

        // 1. Fetch all products in this category (Fetch ALL columns to safely upsert)
        // Note: 'select("*")' returns all columns. 
        const { data: products, error: fetchError } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('category_id', categoryId)

        if (fetchError) {
            console.error('[SYNC] Fetch Error:', fetchError)
            throw fetchError
        }

        console.log(`[SYNC] Found ${products?.length || 0} products for category ${categoryId}`)

        if (!products || products.length === 0) return { success: true, count: 0 }

        // 2. Prepare updates (Modify in memory)
        const updates = products.map(p => {
            const basePrice = Number(p.base_price)
            if (isNaN(basePrice)) {
                console.warn(`[SYNC] Invalid base_price for product ${p.id} (${p.name}):`, p.base_price)
                return null
            }

            const displayPrice = calculateDisplayPrice(basePrice, markupPercentage)
            const margin = calculateMargin(displayPrice, basePrice)

            // Return the COMPLETE object with updated fields
            return {
                ...p,
                display_price: displayPrice,
                your_margin: margin,
                // Ensure updated_at is ignored or handled? 
                // Supabase might require us to omit generated cols if they are not active?
                // Usually safe to send back what we got unless columns are read-only generated.
                // Safest to send what we have.
            }
        }).filter(Boolean) as any[]

        console.log(`[SYNC] Prepared ${updates.length} updates`)

        // 3. Batch Upsert in Chunks
        const CHUNK_SIZE = 500
        let successCount = 0
        let errorCount = 0

        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE)
            console.log(`[SYNC] Upserting chunk ${i / CHUNK_SIZE + 1} (${chunk.length} items)...`)

            const { error: upsertError } = await supabaseAdmin
                .from('products')
                .upsert(chunk)

            if (upsertError) {
                console.error(`[SYNC] Chunk error:`, upsertError)
                errorCount += chunk.length
            } else {
                successCount += chunk.length
            }
        }

        if (errorCount > 0) {
            console.error(`[SYNC] Completed with errors. Success: ${successCount}, Failed: ${errorCount}`)
            throw new Error(`Failed to update ${errorCount} products`)
        }

        console.log(`[SYNC] Successfully updated ${successCount} products`)

        revalidatePath('/', 'layout')
        revalidatePath('/products')
        revalidatePath('/categories')
        revalidatePath('/admin/categories')

        return { success: true, count: successCount }
    } catch (error: any) {
        console.error('[SYNC] Critical Sync Error:', error)
        return { success: false, error: error.message }
    }
}
