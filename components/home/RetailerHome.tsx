'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Sparkles, TrendingUp, Percent, Zap } from 'lucide-react'
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
            .select('*, manufacturer:users!manufacturer_id(is_verified)')
            .eq('is_active', true)
            .limit(24)

        const verifiedProducts = prods?.filter((p: any) => p.manufacturer?.is_verified) || []

        if (cats) setCategories(cats)
        setProducts(shuffle(verifiedProducts.length > 0 ? verifiedProducts : prods || []))
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-gray-500 text-sm">Loading your feed...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="pb-24 md:pb-8 bg-gray-50 min-h-screen">
            {/* Hero Promo Banner */}
            <div className="px-4 pt-4 md:pt-6">
                <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
                    {/* Decorative Elements */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-60 h-60 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
                    </div>

                    <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1 text-center md:text-left">
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                                <Sparkles className="w-3 h-3" />
                                New Year Special
                            </div>
                            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 leading-tight">
                                Bulk Orders,<br className="hidden md:block" /> Maximum Profits
                            </h2>
                            <p className="text-emerald-100 text-sm md:text-base mb-5 max-w-md">
                                Get up to 40% margin on trending products. Direct from verified manufacturers.
                            </p>
                            <Link
                                href="/products"
                                className="inline-flex items-center gap-2 bg-white text-emerald-700 px-6 py-3 rounded-full font-bold text-sm hover:bg-emerald-50 shadow-lg hover:shadow-xl transition-all group"
                            >
                                Explore Products
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                        {/* Stats */}
                        <div className="flex gap-4 md:gap-6">
                            <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                                <div className="text-2xl md:text-3xl font-bold text-white">500+</div>
                                <div className="text-emerald-200 text-xs">Suppliers</div>
                            </div>
                            <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                                <div className="text-2xl md:text-3xl font-bold text-white">10K+</div>
                                <div className="text-emerald-200 text-xs">Products</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="px-4 mt-6">
                <div className="grid grid-cols-3 gap-3">
                    <Link href="/products?filter=trending" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-rose-500 rounded-full flex items-center justify-center text-white">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-emerald-600">Trending</span>
                    </Link>
                    <Link href="/products?filter=deals" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white">
                            <Percent className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-emerald-600">Deals</span>
                    </Link>
                    <Link href="/products?filter=new" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center text-white">
                            <Zap className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-emerald-600">New Arrivals</span>
                    </Link>
                </div>
            </div>

            {/* Categories Rail */}
            <div className="mt-8">
                <div className="px-4 flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-gray-900">Shop by Category</h3>
                    <Link href="/categories" className="text-emerald-600 text-sm font-semibold hover:underline flex items-center gap-1">
                        See All <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 px-4 no-scrollbar snap-x snap-mandatory">
                    {categories.map(cat => (
                        <Link
                            key={cat.id}
                            href={`/products?category=${cat.slug}`}
                            className="flex flex-col items-center min-w-[72px] snap-start group"
                        >
                            <div className="w-16 h-16 md:w-18 md:h-18 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-2 overflow-hidden border-2 border-transparent group-hover:border-emerald-500 group-hover:shadow-lg transition-all flex items-center justify-center">
                                {cat.image_url ? (
                                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl">{cat.name?.[0]?.toUpperCase() || '?'}</span>
                                )}
                            </div>
                            <span className="text-[11px] text-center text-gray-700 font-medium line-clamp-2 group-hover:text-emerald-600 transition-colors">
                                {cat.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="px-4 mt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-gray-900">Recommended for You</h3>
                    <Link href="/products" className="text-emerald-600 text-sm font-semibold hover:underline flex items-center gap-1">
                        View All <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {products.slice(0, 12).map(product => (
                        <Link
                            key={product.id}
                            href={`/products/${product.id}`}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-emerald-200 transition-all flex flex-col group"
                        >
                            <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                {product.images?.[0] ? (
                                    <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                        <span className="text-4xl">📦</span>
                                    </div>
                                )}
                                {/* MOQ Badge */}
                                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-bold text-white">
                                    MOQ: {product.moq}
                                </div>
                            </div>
                            <div className="p-3 flex flex-col flex-1">
                                <h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
                                    {product.name}
                                </h4>
                                <div className="mt-auto space-y-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-emerald-600 font-bold text-base">
                                            {formatCurrency(product.display_price || product.price)}
                                        </span>
                                        {product.base_price && product.display_price > product.base_price && (
                                            <span className="text-xs text-gray-400 line-through">
                                                {formatCurrency(Math.round(product.display_price * 1.15))}
                                            </span>
                                        )}
                                    </div>
                                    {/* Margin Pill */}
                                    <div className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                                        <TrendingUp className="w-3 h-3" />
                                        Earn ₹{Math.round(product.your_margin || (product.display_price * 0.15))}/unit
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Load More */}
                <div className="mt-8 text-center">
                    <Link
                        href="/products"
                        className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white font-semibold rounded-full hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all"
                    >
                        Browse All Products
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    )
}
