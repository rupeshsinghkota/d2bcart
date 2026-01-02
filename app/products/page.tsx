import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import ProductsClient from './ProductsClient'
import { Product, Category } from '@/types'

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getCategories() {
    // 1. Get all active product category IDs
    // Optimization: This could be large. In production, use a materialized view 'active_category_ids'.
    const { data: activeLinkages, error: prodErr } = await supabase
        .from('products')
        .select('category_id')
        .eq('is_active', true)

    if (prodErr) {
        console.error('Error fetching active product categories:', prodErr)
        return []
    }

    const activeIds = new Set(activeLinkages?.map(p => p.category_id).filter(Boolean))

    if (activeIds.size === 0) return []

    // 2. Fetch all categories (standard) - we need them for hierarchy resolution
    const { data: allCategories } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    if (!allCategories) return []

    // 3. Filter: Keep a category if IT has products OR ANY OF ITS DESCENDANTS have products.
    // Use a recursive check.

    const hasActiveDescendant = (catId: string): boolean => {
        if (activeIds.has(catId)) return true
        // Check children
        const children = allCategories.filter(c => c.parent_id === catId)
        return children.some(child => hasActiveDescendant(child.id))
    }

    const validCategories = (allCategories as Category[]).filter(cat => hasActiveDescendant(cat.id))

    return validCategories
}

async function getCategoryBySlug(slug: string) {
    const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single()
    return data as Category | null
}

async function getProducts(categoryId?: string, searchQuery?: string) {
    let query = supabase
        .from('products')
        .select(`
      *,
      manufacturer:users!manufacturer_id(business_name, city, is_verified),
      category:categories!products_category_id_fkey(name, slug)
    `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    if (categoryId) {
        // We need to fetch descendants.
        // For SSR speed/simplicity, fetching just direct matches or full tree? 
        // To match Client behavior, we need full tree.
        // This implies a recursive fetch which might be slow without a database function.
        // However, we can fetch all categories once (cached usually or fast enough) and calculate tree.
        const allCats = await getCategories()

        const getDescendants = (parentId: string): string[] => {
            const children = allCats.filter(c => c.parent_id === parentId)
            let ids = children.map(c => c.id)
            children.forEach(child => {
                ids = [...ids, ...getDescendants(child.id)]
            })
            return ids
        }
        const targetIds = [categoryId, ...getDescendants(categoryId)]
        query = query.in('category_id', targetIds)
    }

    // Note: Search query is filtered client-side in original code (on name/description).
    // Server-side filtering on Supabase for "ilike" on multiple columns is possible but
    // to perfectly match client behavior (and if data set is small), we can fetch all and filter?
    // Or just return the category products and let Client filter the specific search query if present?
    // Current design: Client receives initialProducts. If we return UNFILTERED products for a category,
    // and pass searchQuery as prop, client will filter them immediately.
    // This is better for consistency.

    const { data } = await query
    return (data as Product[]) || []
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    const params = await searchParams
    const categorySlug = typeof params.category === 'string' ? params.category : undefined
    const searchQuery = typeof params.search === 'string' ? params.search : undefined

    if (categorySlug) {
        const category = await getCategoryBySlug(categorySlug)
        if (category) {
            return {
                title: `${category.name} | D2BCart`,
                description: `Browse wholesale ${category.name} from verified manufacturers on D2BCart.`,
                openGraph: {
                    title: `${category.name} | D2BCart`,
                    description: `Browse wholesale ${category.name} directly from manufacturers.`,
                }
            }
        }
    }

    if (searchQuery) {
        return {
            title: `Results for "${searchQuery}" | D2BCart`,
            description: `Search results for ${searchQuery} on D2BCart.`,
        }
    }

    return {
        title: 'All Products | D2BCart',
        description: 'Browse our complete catalog of wholesale products directly from manufacturers.',
    }
}

export default async function ProductsPage({ searchParams }: Props) {
    const params = await searchParams
    const categorySlug = typeof params.category === 'string' ? params.category : undefined
    const searchQuery = typeof params.search === 'string' ? params.search : undefined

    const categories = await getCategories()
    let currentCategory: Category | null = null

    if (categorySlug) {
        currentCategory = categories.find(c => c.slug === categorySlug) || null
    }

    // Fetch initial products
    // Optimization: If search query exists, we might normally look everywhere.
    // But if category is selected, we scope to category.
    const products = await getProducts(currentCategory?.id, searchQuery)

    // Collection Page JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: currentCategory ? currentCategory.name : 'All Products',
        description: currentCategory ? `Wholesale ${currentCategory.name}` : 'Wholesale Products',
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/products${categorySlug ? `?category=${categorySlug}` : ''}`,
        itemListElement: products.slice(0, 20).map((product, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: product.name,
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/products/${product.id}`
        }))
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProductsClient
                initialProducts={products}
                initialCategories={categories}
                initialSelectedCategory={categorySlug || ''}
            />
        </>
    )
}
