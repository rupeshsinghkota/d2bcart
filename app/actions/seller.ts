'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { Product } from '@/types'

export async function getSellerProductsAction(sellerId: string, page: number = 1, limit: number = 12) {
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: products, error, count } = await supabaseAdmin
        .from('products')
        .select(`
            *,
            manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
            category:categories!products_category_id_fkey(name, slug),
            variations:products!parent_id(display_price)
        `, { count: 'exact' })
        .eq('manufacturer_id', sellerId)
        .eq('is_active', true)
        .is('parent_id', null) // Exclude variations
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) {
        console.error('Error fetching seller products:', error)
        return { products: [], total: 0 }
    }

    return {
        products: (products as Product[]) || [],
        total: count || 0
    }
}

export async function getSellerCategoriesAction(sellerId: string) {
    const { data, error } = await supabaseAdmin
        .from('products')
        .select('category:categories!products_category_id_fkey(name, slug)')
        .eq('manufacturer_id', sellerId)
        .eq('is_active', true)
        .is('parent_id', null)

    if (error) {
        console.error('Error fetching seller categories:', error)
        return []
    }

    // Deduplicate categories based on slug
    const uniqueCategories = new Map()
    data?.forEach((item: any) => {
        if (item.category) {
            uniqueCategories.set(item.category.slug, item.category)
        }
    })

    return Array.from(uniqueCategories.values())
}

