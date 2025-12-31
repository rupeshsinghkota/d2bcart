'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Sparkles, TrendingUp, Percent, Zap, Package, Star, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// Helper to shuffle array for "random" feed
const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5)

export default function RetailerHome() {
    const [categories, setCategories] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        // Fetch top level categories
        const { data: cats } = await supabase
            .from('categories')
            .select('*')
            .is('parent_id', null)
            .limit(12)

        // Fetch featured products from verified manufacturers
        const { data: prods } = await supabase
            .from('products')
            .select('*, manufacturer:users!manufacturer_id(is_verified, business_name)')
            .eq('is_active', true)
            .limit(24)

        const verifiedProducts = prods?.filter((p: any) => p.manufacturer?.is_verified) || []

        if (cats) setCategories(cats)
        setProducts(shuffle(verifiedProducts.length > 0 ? verifiedProducts : prods || []))
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-gray-500 text-sm font-medium">Loading your personalized feed...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="pb-24 md:pb-8 bg-gray-50 min-h-screen">
            {/* Hero Section - Full Width */}
            <section className="px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8">
                <div className="max-w-7xl mx-auto">
                    <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl">
                        {/* Decorative Background */}
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-80 h-80 md:w-[500px] md:h-[500px] bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                            <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full"></div>
                        </div>

                        <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-14">
                            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                                {/* Left Content */}
                                <div className="flex-1 text-center lg:text-left max-w-2xl">
                                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md text-white text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
                                        <Sparkles className="w-4 h-4" />
                                        New Year Special Offers
                                    </div>
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                                        Bulk Orders,<br />
                                        <span className="text-emerald-200">Maximum Profits</span>
                                    </h1>
                                    <p className="text-emerald-100 text-base sm:text-lg mb-6 lg:mb-8 max-w-lg mx-auto lg:mx-0">
                                        Source directly from 500+ verified manufacturers. Enjoy up to 40% profit margins on every order.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                                        <Link
                                            href="/products"
                                            className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 px-8 py-4 rounded-xl font-bold text-sm sm:text-base hover:bg-emerald-50 shadow-lg hover:shadow-xl transition-all group"
                                        >
                                            Explore Products
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                        <Link
                                            href="/categories"
                                            className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur text-white border border-white/30 px-8 py-4 rounded-xl font-bold text-sm sm:text-base hover:bg-white/20 transition-all"
                                        >
                                            Browse Categories
                                        </Link>
                                    </div>
                                </div>

                                {/* Right Stats Grid */}
                                <div className="grid grid-cols-2 gap-4 sm:gap-5 w-full max-w-xs lg:max-w-sm">
                                    <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 text-center">
                                        <div className="text-3xl sm:text-4xl font-bold text-white mb-1">500+</div>
                                        <div className="text-emerald-200 text-sm">Verified Suppliers</div>
                                    </div>
                                    <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 text-center">
                                        <div className="text-3xl sm:text-4xl font-bold text-white mb-1">10K+</div>
                                        <div className="text-emerald-200 text-sm">Products</div>
                                    </div>
                                    <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 text-center">
                                        <div className="text-3xl sm:text-4xl font-bold text-white mb-1">40%</div>
                                        <div className="text-emerald-200 text-sm">Avg. Margin</div>
                                    </div>
                                    <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 text-center">
                                        <div className="text-3xl sm:text-4xl font-bold text-white mb-1">24h</div>
                                        <div className="text-emerald-200 text-sm">Fast Dispatch</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Actions */}
            <section className="px-4 sm:px-6 lg:px-8 mt-6 lg:mt-10">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                        {[
                            { href: '/products?filter=trending', icon: TrendingUp, label: 'Trending', gradient: 'from-orange-400 to-rose-500' },
                            { href: '/products?filter=deals', icon: Percent, label: 'Best Deals', gradient: 'from-emerald-400 to-teal-500' },
                            { href: '/products?filter=new', icon: Zap, label: 'New Arrivals', gradient: 'from-violet-400 to-purple-500' },
                            { href: '/retailer/orders', icon: Package, label: 'My Orders', gradient: 'from-blue-400 to-indigo-500', hideOnMobile: true },
                        ].map((item, idx) => (
                            <Link
                                key={idx}
                                href={item.href}
                                className={`flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-5 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:border-emerald-300 hover:shadow-lg transition-all group ${item.hideOnMobile ? 'hidden sm:flex' : ''}`}
                            >
                                <div className={`w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br ${item.gradient} rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                                    <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <span className="text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-emerald-600 text-center">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Categories Section */}
            <section className="mt-8 lg:mt-12">
                <div className="max-w-7xl mx-auto">
                    <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between mb-4 lg:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Shop by Category</h2>
                        <Link href="/categories" className="text-emerald-600 text-sm sm:text-base font-semibold hover:underline inline-flex items-center gap-1">
                            See All <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Link>
                    </div>
                    {/* Mobile: Horizontal Scroll | Desktop: Grid */}
                    <div className="flex lg:hidden gap-4 overflow-x-auto pb-4 px-4 no-scrollbar snap-x snap-mandatory">
                        {categories.map(cat => (
                            <CategoryCard key={cat.id} cat={cat} />
                        ))}
                    </div>
                    <div className="hidden lg:grid grid-cols-6 xl:grid-cols-8 gap-4 px-8">
                        {categories.slice(0, 8).map(cat => (
                            <CategoryCard key={cat.id} cat={cat} />
                        ))}
                    </div>
                </div>
            </section>

            {/* Products Section */}
            <section className="px-4 sm:px-6 lg:px-8 mt-8 lg:mt-12">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4 lg:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Recommended for You</h2>
                        <Link href="/products" className="text-emerald-600 text-sm sm:text-base font-semibold hover:underline inline-flex items-center gap-1">
                            View All <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
                        {products.slice(0, 15).map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>

                    {/* Load More CTA */}
                    <div className="mt-10 lg:mt-14 text-center">
                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 px-10 py-4 bg-emerald-600 text-white font-bold rounded-xl sm:rounded-2xl hover:bg-emerald-700 shadow-xl hover:shadow-2xl transition-all text-sm sm:text-base"
                        >
                            Browse All Products
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    )
}

// Category Card Component
function CategoryCard({ cat }: { cat: any }) {
    return (
        <Link
            href={`/products?category=${cat.slug}`}
            className="flex flex-col items-center min-w-[80px] lg:min-w-0 snap-start group"
        >
            <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl lg:rounded-3xl mb-2 lg:mb-3 overflow-hidden border-2 border-transparent group-hover:border-emerald-500 group-hover:shadow-xl transition-all flex items-center justify-center">
                {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-2xl lg:text-3xl font-bold text-gray-400">{cat.name?.[0]?.toUpperCase() || '?'}</span>
                )}
            </div>
            <span className="text-[11px] sm:text-xs lg:text-sm text-center text-gray-700 font-medium line-clamp-2 group-hover:text-emerald-600 transition-colors max-w-[80px] lg:max-w-full">
                {cat.name}
            </span>
        </Link>
    )
}

// Product Card Component
function ProductCard({ product }: { product: any }) {
    return (
        <Link
            href={`/products/${product.id}`}
            className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:border-emerald-200 transition-all flex flex-col group"
        >
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {product.images?.[0] ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <Package className="w-12 h-12 text-gray-300" />
                    </div>
                )}
                {/* MOQ Badge */}
                <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold text-white">
                    MOQ: {product.moq}
                </div>
                {/* Verified Badge */}
                {product.manufacturer?.is_verified && (
                    <div className="absolute top-2 right-2 bg-emerald-500 p-1.5 rounded-full">
                        <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                )}
            </div>
            <div className="p-3 sm:p-4 flex flex-col flex-1">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2 mb-2 min-h-[2.5rem] sm:min-h-[3rem]">
                    {product.name}
                </h4>
                {product.manufacturer?.business_name && (
                    <p className="text-xs text-gray-500 mb-2 truncate">by {product.manufacturer.business_name}</p>
                )}
                <div className="mt-auto space-y-2">
                    <div className="flex items-baseline gap-2">
                        <span className="text-emerald-600 font-bold text-base sm:text-lg">
                            {formatCurrency(product.display_price || product.base_price)}
                        </span>
                        <span className="text-xs text-gray-400 line-through">
                            {formatCurrency(Math.round((product.display_price || product.base_price) * 1.2))}
                        </span>
                    </div>
                    {/* Profit Badge */}
                    <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg font-semibold">
                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                        Profit: ₹{Math.round(product.your_margin || (product.display_price * 0.15))}/unit
                    </div>
                </div>
            </div>
        </Link>
    )
}
