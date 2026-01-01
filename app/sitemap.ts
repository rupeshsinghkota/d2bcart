import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'

    // Initialize Supabase client
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fetch all products
    const { data: products } = await supabase
        .from('products')
        .select('id, updated_at')

    // Fetch all categories
    const { data: categories } = await supabase
        .from('categories')
        .select('slug')

    // Static routes
    const routes = [
        '',
        '/login',
        '/register',
        '/products',
        '/categories',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }))

    // Product routes
    const productRoutes = (products || []).map((product) => ({
        url: `${baseUrl}/products/${product.id}`,
        lastModified: new Date(product.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    // Category routes
    const categoryRoutes = (categories || []).map((category) => ({
        url: `${baseUrl}/products?category=${category.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    return [...routes, ...productRoutes, ...categoryRoutes]
}
