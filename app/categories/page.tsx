import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import CategoriesClient from './CategoriesClient'
import { Category } from '@/types'

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const metadata: Metadata = {
    title: 'Browse Categories | D2BCart',
    description: 'Explore all product categories on D2BCart. Wholesale electronics, fashion, home goods, and more directly from manufacturers.',
}

async function getCategories() {
    const { data } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    return (data as Category[]) || []
}

export default async function CategoriesPage() {
    const categories = await getCategories()

    return (
        <CategoriesClient initialCategories={categories} />
    )
}
