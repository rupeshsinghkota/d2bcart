'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ChevronRight, ChevronLeft, Sparkles, TrendingUp, Percent, Zap, Package, Star, ArrowRight, Loader2, Plus } from 'lucide-react'
import { getCategoryImage } from '@/utils/category'
import { formatCurrency } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { toast } from 'react-hot-toast'

// Helper to shuffle array for "random" feed
const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5)

export default function RetailerHome() {
    const [categories, setCategories] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 24

    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef
            const scrollAmount = direction === 'left' ? -300 : 300
            current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }
    }

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

        await fetchProducts(1)

        if (cats) setCategories(cats)
    }

    const fetchProducts = async (pageNum: number) => {
        const from = (pageNum - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        const { data: prods } = await supabase
            .from('products')
            .select('*, manufacturer:users!manufacturer_id(is_verified, business_name)')
            .eq('is_active', true)
            .range(from, to)

        if (prods) {
            const verified = prods.filter((p: any) => p.manufacturer?.is_verified)
            // Mix verified and unverified for variety, but prioritize verified
            const newProds = shuffle(verified.length > 0 ? verified : prods)

            if (pageNum === 1) {
                setProducts(newProds)
                setLoading(false)
            } else {
                setProducts(prev => [...prev, ...newProds])
                setLoadingMore(false)
            }
        }
    }

    const handleLoadMore = () => {
        setLoadingMore(true)
        const nextPage = page + 1
        setPage(nextPage)
        fetchProducts(nextPage)
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
            {/* Compact Hero Section */}
            <section className="px-3 sm:px-6 lg:px-8 pt-2 md:pt-6">
                <div className="max-w-7xl mx-auto">
                    <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 rounded-xl lg:rounded-2xl overflow-hidden shadow-sm">

                        <div className="relative z-10 px-4 py-4 sm:p-8 flex items-center justify-between gap-4">
                            <div className="flex-1 max-w-xl">
                                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-white text-[9px] sm:text-xs font-bold px-2 py-0.5 rounded-full mb-2">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Special Offer</span>
                                </div>
                                <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold text-white mb-1.5 leading-tight">
                                    Maximize Your <span className="text-emerald-200">Profits</span>
                                </h1>
                                <p className="text-emerald-50 text-[10px] sm:text-sm md:text-base mb-3 max-w-md opacity-90 leading-relaxed line-clamp-1 sm:line-clamp-none">
                                    Direct from 500+ verified factories. Save big.
                                </p>
                                <div className="flex gap-2">
                                    <Link
                                        href="/products"
                                        className="inline-flex items-center justify-center gap-1.5 bg-white text-emerald-700 px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm hover:bg-emerald-50 transition-all shadow-sm active:scale-95"
                                    >
                                        Shop Now
                                        <ArrowRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>

                            {/* Hero Right Visual (Desktop Only) */}
                            <div className="hidden md:block w-64 h-full relative">
                                <div className="grid grid-cols-2 gap-3 opacity-80 transform rotate-[-5deg] scale-90">
                                    <div className="bg-white/10 backdrop-blur p-3 rounded-xl text-center text-white">
                                        <div className="text-2xl font-bold">500+</div>
                                        <div className="text-[10px] text-emerald-100">Factory Owners</div>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur p-3 rounded-xl text-center text-white translate-y-4">
                                        <div className="text-2xl font-bold">50+</div>
                                        <div className="text-[10px] text-emerald-100">Categories</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* Categories Section */}
            <section className="mt-3 sm:mt-6">
                <div className="max-w-7xl mx-auto">
                    <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between mb-2 sm:mb-3.5">
                        <h2 className="text-sm sm:text-xl font-bold text-gray-900">Shop by Category</h2>
                        <div className="flex items-center gap-2">
                            {/* Desktop Scroll Arrows */}
                            <div className="hidden md:flex gap-1">
                                <button onClick={() => scroll('left')} className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-emerald-600 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => scroll('right')} className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-emerald-600 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <Link href="/categories" className="text-emerald-600 text-[10px] sm:text-sm font-semibold hover:underline">
                                See All
                            </Link>
                        </div>
                    </div>
                    {/* Horizontal Scroll with Generated Images */}
                    <div
                        ref={scrollContainerRef}
                        className="flex overflow-x-auto pb-4 px-4 sm:px-8 gap-3 sm:gap-5 no-scrollbar snap-x scroll-smooth"
                    >
                        {categories.map(cat => (
                            <CategoryCard key={cat.id} cat={cat} />
                        ))}
                    </div>
                </div>
            </section>

            {/* Recommended Products */}
            <section className="px-3 sm:px-6 lg:px-8 mt-2 sm:mt-6">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-sm sm:text-xl font-bold text-gray-900 mb-3 px-1">Recommended for You</h2>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>

                    {/* Load More Button */}
                    <div className="mt-8 mb-4 text-center">
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-full hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all text-xs sm:text-sm disabled:opacity-70"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    Load More Products
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )
}





function CategoryCard({ cat }: { cat: any }) {
    const generatedImg = getCategoryImage(cat.name)

    return (
        <Link
            href={`/products?category=${cat.slug}`}
            className="flex flex-col items-center min-w-[72px] sm:min-w-[90px] snap-start group"
        >
            <div className={`
                w-[72px] h-[72px] sm:w-[90px] sm:h-[90px] 
                rounded-2xl sm:rounded-3xl mb-2 
                overflow-hidden border border-gray-100 relative
                bg-gray-50
                group-hover:shadow-lg group-hover:border-emerald-200 transition-all
            `}>
                {(() => {
                    const generatedImg = getCategoryImage(cat.name)
                    if (generatedImg) return (
                        <img
                            src={generatedImg}
                            alt={cat.name}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                        />
                    )
                    if (cat.image_url) return (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                    )
                    return (
                        <div className="w-full h-full flex items-center justify-center text-xl sm:text-3xl bg-gray-100">
                            {cat.name?.[0]?.toUpperCase()}
                        </div>
                    )
                })()}
            </div>
            <span className="text-[10px] sm:text-xs text-center text-gray-700 font-medium line-clamp-2 max-w-[72px] sm:max-w-full leading-tight">
                {cat.name}
            </span>
        </Link>
    )
}

function ProductCard({ product }: { product: any }) {
    return (
        <Link
            href={`/products/${product.id}`}
            className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col group active:scale-[0.98]"
        >
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {product.images?.[0] ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <Package className="w-8 h-8 text-gray-300" />
                    </div>
                )}
                {/* MOQ Badge - Compact */}
                <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-[2px] px-1.5 py-0.5 rounded text-[9px] font-bold text-white">
                    MOQ: {product.moq}
                </div>
            </div>
            <div className="p-2 sm:p-3 flex flex-col flex-1">
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm line-clamp-2 mb-1.5 leading-snug min-h-[2.5em]">
                    {product.name}
                </h4>
                <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-emerald-700 font-bold text-sm sm:text-base">
                            {formatCurrency(product.display_price || product.base_price)}
                        </span>
                    </div>

                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            useStore.getState().addToCart(product, product.moq);
                            toast.success('Added to cart!');
                        }}
                        className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100/50"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </Link>
    )
}
