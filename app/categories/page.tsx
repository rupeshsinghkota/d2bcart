import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import CategoriesClient from './CategoriesClient'
import { Category } from '@/types'

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const revalidate = 3600 // Revalidate every hour

export const metadata: Metadata = {
    title: 'Browse Categories | D2BCart',
    description: 'Explore all product categories on D2BCart. Wholesale electronics, fashion, home goods, and more directly from manufacturers.',
}

async function getCategories() {
    // 1. Get unique category IDs that have active products
    // 1. Get unique category IDs that have active products
    const { data: activeLinkages, error: prodErr } = await supabase
        .from('categories')
        .select('id, products!inner(id)')
        .eq('products.is_active', true)

    if (prodErr) {
        console.error('Error fetching active product categories:', prodErr)
        return []
    }

    const activeIds = new Set(activeLinkages?.map(c => c.id))

    if (activeIds.size === 0) return []

    // 2. Fetch all categories
    const { data: allCategories } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    if (!allCategories) return []

    // 3. Filter using recursive check
    const hasActiveDescendant = (catId: string): boolean => {
        if (activeIds.has(catId)) return true
        // Check children
        const children = allCategories.filter(c => c.parent_id === catId)
        return children.some(child => hasActiveDescendant(child.id))
    }

    const validCategories = (allCategories as Category[]).filter(cat => hasActiveDescendant(cat.id))

    return validCategories
}

export default async function CategoriesPage() {
    const categories = await getCategories()

    return (
        <CategoriesClient initialCategories={categories} />
    )
}
