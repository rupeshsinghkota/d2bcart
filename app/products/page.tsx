import { Metadata } from 'next'
import ProductsClient from './ProductsClient'
import { Category } from '@/types'
import { getShopData } from '../actions/getShopData'
import { createClient } from '@/lib/supabase-server'

import { Suspense } from 'react'

// export const dynamic = 'force-dynamic'

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getCategoryBySlug(slug: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single()
    return data as Category | null
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
    return (
        <Suspense fallback={<ProductsSkeleton />}>
            <ProductsContent searchParams={searchParams} />
        </Suspense>
    )
}

async function ProductsContent({ searchParams }: Props) {
    const params = await searchParams
    const categorySlug = typeof params.category === 'string' ? params.category : undefined

    // 1. Fetch Categories (Always needed for sidebar)
    const { categories: allCategories } = await getShopData()

    let currentCategory: Category | null = null
    if (categorySlug) {
        currentCategory = allCategories.find(c => c.slug === categorySlug) || null
    }

    // 2. Fetch Initial Products (Scoped to category if selected)
    const { products, totalProducts } = await getShopData(currentCategory?.id)

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
                initialCategories={allCategories}
                initialSelectedCategory={categorySlug || ''}
                initialTotal={totalProducts}
            />
        </>
    )
}

function ProductsSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Skeleton */}
                <div className="hidden md:block w-64 space-y-4">
                    <div className="h-40 bg-gray-100 rounded-xl" />
                    <div className="h-64 bg-gray-100 rounded-xl" />
                </div>
                {/* Main Content Skeleton */}
                <div className="flex-1 space-y-6">
                    <div className="h-12 bg-gray-100 rounded-xl w-3/4" />
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="aspect-[3/4] bg-gray-100 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
