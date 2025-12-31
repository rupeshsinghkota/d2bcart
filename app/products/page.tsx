'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Search, Filter, Package, MapPin, Heart } from 'lucide-react'
import { toast } from 'react-hot-toast'

const ProductsContent = () => {
    const searchParams = useSearchParams()
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>(
        searchParams.get('category') || ''
    )
    const [wishlist, setWishlist] = useState<string[]>([])

    useEffect(() => {
        fetchCategories()
        fetchProducts()
        fetchWishlist()
    }, [selectedCategory])

    const fetchWishlist = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('wishlists')
            .select('product_id')
            .eq('user_id', user.id)

        if (data) setWishlist((data as any[]).map(w => w.product_id))
    }

    const toggleWishlist = async (e: React.MouseEvent, productId: string) => {
        e.preventDefault()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            toast.error('Please login to wishlist items')
            return
        }

        if (wishlist.includes(productId)) {
            // Remove
            const { error } = await supabase
                .from('wishlists')
                .delete()
                .match({ user_id: user.id, product_id: productId })

            if (!error) {
                setWishlist(prev => prev.filter(id => id !== productId))
                toast.success('Removed from wishlist')
            }
        } else {
            // Add
            const { error } = await (supabase.from('wishlists') as any)
                .insert({ user_id: user.id, product_id: productId })

            if (!error) {
                setWishlist(prev => [...prev, productId])
                toast.success('Added to wishlist')
            }
        }
    }

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name')

        if (data) setCategories(data)
    }

    const fetchProducts = async () => {
        setLoading(true)
        let query = supabase
            .from('products')
            .select(`
        *,
        manufacturer:users!products_manufacturer_id_fkey!inner(business_name, city, is_verified),
        category:categories!products_category_id_fkey(name, slug)
      `)
            .eq('is_active', true)
            .eq('manufacturer.is_verified', true)
            .order('created_at', { ascending: false })

        if (selectedCategory) {
            // First get category ID from slug
            const { data: cat } = await supabase
                .from('categories')
                .select('id')
                .eq('slug', selectedCategory)
                .single()

            if (cat) {
                query = query.eq('category_id', (cat as any).id)
            }
        }

        const { data, error } = await query

        if (data) {
            setProducts(data as Product[])
        }
        setLoading(false)
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-16 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h1 className="text-2xl font-bold text-gray-900">Products</h1>

                        {/* Search */}
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Category Pills */}
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                        <button
                            onClick={() => setSelectedCategory('')}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedCategory
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            All Categories
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.slug)}
                                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.slug
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse">
                                <div className="h-48 bg-gray-200" />
                                <div className="p-4 space-y-3">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-6 bg-gray-200 rounded w-1/2" />
                                    <div className="h-3 bg-gray-200 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">
                            No products found
                        </h3>
                        <p className="text-gray-500">
                            Try adjusting your search or filter criteria
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-gray-600 mb-6">
                            Showing {filteredProducts.length} products
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {filteredProducts.map(product => (
                                <div key={product.id} className="relative group">
                                    <Link
                                        href={`/products/${product.id}`}
                                        className="block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all"
                                    >
                                        {/* Image */}
                                        <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                                            {product.images?.[0] ? (
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-12 h-12 text-gray-300" />
                                                </div>
                                            )}
                                            {product.category && (
                                                <span className="absolute top-3 left-3 bg-white/90 px-2 py-1 rounded-full text-xs font-medium text-gray-600">
                                                    {product.category.name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="p-4">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors line-clamp-2">
                                                {product.name}
                                            </h3>

                                            <div className="mt-2 flex items-baseline gap-2">
                                                <span className="text-2xl font-bold text-emerald-600">
                                                    {formatCurrency(product.display_price)}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    / unit
                                                </span>
                                            </div>

                                            <div className="mt-2 text-sm text-gray-500">
                                                MOQ: {product.moq} units
                                            </div>

                                            {product.manufacturer && (
                                                <div className="mt-3 flex items-center gap-1 text-sm text-gray-500">
                                                    <MapPin className="w-4 h-4" />
                                                    {product.manufacturer.city}
                                                    <span className="mx-1">•</span>
                                                    {product.manufacturer.business_name}
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                    <button
                                        onClick={(e) => toggleWishlist(e, product.id)}
                                        className={`absolute top-3 right-3 p-2 rounded-full shadow-sm transition-colors z-10 ${wishlist.includes(product.id)
                                            ? 'bg-red-50 text-red-500'
                                            : 'bg-white/90 text-gray-400 hover:text-red-500'
                                            }`}
                                    >
                                        <Heart className={`w-5 h-5 ${wishlist.includes(product.id) ? 'fill-current' : ''}`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default function ProductsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading products...</div>}>
            <ProductsContent />
        </Suspense>
    )
}
