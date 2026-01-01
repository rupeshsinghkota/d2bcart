'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Sparkles, TrendingUp, Percent, Zap, Package, Star, ArrowRight, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// Helper to shuffle array for "random" feed
const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5)

// Manual mapping of generated images (assuming they are moved to public/category-images)
const CATEGORY_IMAGES: Record<string, string> = {
    'electronics': '/category-images/electronics.png',
    'appliances': '/category-images/appliances.png',
    'fashion': '/category-images/fashion.png',
    'footwear': '/category-images/footwear.png',
    'grocery': '/category-images/grocery.png',
    'beauty': '/category-images/beauty.png',
    'personal care': '/category-images/beauty.png',
    'home': '/category-images/home.png',
    'kitchen': '/category-images/kitchen.png',
    'industrial': '/category-images/industrial.png',
    'office': '/category-images/industrial.png',
    'toys': '/category-images/toys.png',
    'baby': '/category-images/toys.png',
    'sports': '/category-images/sports.png',
    'automotive': '/category-images/automotive.png',
    'car': '/category-images/automotive.png',
    'hardware': '/category-images/hardware.png',
}

export default function RetailerHome() {
    const [categories, setCategories] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 24

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
            <section className="px-3 sm:px-6 lg:px-8 pt-3 md:pt-6">
                <div className="max-w-7xl mx-auto">
                    <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 rounded-xl lg:rounded-2xl overflow-hidden shadow-lg">
                        {/* Decorative Background */}
                        <div className="absolute inset-0 overflow-hidden opacity-20">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                        </div>

                        <div className="relative z-10 px-5 py-6 sm:p-8 md:p-10 flex items-center justify-between gap-6">
                            <div className="flex-1 max-w-xl">
                                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full mb-3">
                                    <Sparkles className="w-3 h-3" />
                                    <span>New Year Special</span>
                                </div>
                                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight">
                                    Bulk Orders, <span className="text-emerald-200">Max Profits</span>
                                </h1>
                                <p className="text-emerald-50 text-xs sm:text-sm md:text-base mb-5 max-w-md opacity-90 leading-relaxed">
                                    Direct from 500+ verified factories. Save up to 40%.
                                </p>
                                <div className="flex gap-3">
                                    <Link
                                        href="/products"
                                        className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm hover:bg-emerald-50 transition-all shadow-sm active:scale-95"
                                    >
                                        Shop Now
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                    <Link
                                        href="/categories"
                                        className="inline-flex items-center justify-center gap-2 bg-white/10 text-white border border-white/20 px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm hover:bg-white/20 transition-all active:scale-95"
                                    >
                                        Categories
                                    </Link>
                                </div>
                            </div>

                            {/* Hero Right Visual (Desktop Only) */}
                            <div className="hidden md:block w-64 h-full relative">
                                <div className="grid grid-cols-2 gap-3 opacity-80 transform rotate-[-5deg]">
                                    <div className="bg-white/10 backdrop-blur p-3 rounded-xl text-center text-white">
                                        <div className="text-2xl font-bold">500+</div>
                                        <div className="text-[10px] text-emerald-100">Factory Owners</div>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur p-3 rounded-xl text-center text-white translate-y-4">
                                        <div className="text-2xl font-bold">40%</div>
                                        <div className="text-[10px] text-emerald-100">Margins</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Compact Quick Actions */}
            <section className="px-3 sm:px-6 lg:px-8 mt-4">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
                        {[
                            { href: '/products?filter=trending', icon: TrendingUp, label: 'Trending', bg: 'bg-orange-50', text: 'text-orange-600' },
                            { href: '/products?filter=deals', icon: Percent, label: 'Deals', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                            { href: '/products?filter=new', icon: Zap, label: 'New', bg: 'bg-violet-50', text: 'text-violet-600' },
                            { href: '/retailer/orders', icon: Package, label: 'Orders', bg: 'bg-blue-50', text: 'text-blue-600', hideOnMobile: true },
                        ].map((item, idx) => (
                            <Link
                                key={idx}
                                href={item.href}
                                className={`flex items-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform ${item.hideOnMobile ? 'hidden sm:flex' : 'flex'}`}
                            >
                                <div className={`w-8 h-8 rounded-full ${item.bg} ${item.text} flex items-center justify-center`}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Categories Section */}
            <section className="mt-6 sm:mt-8">
                <div className="max-w-7xl mx-auto">
                    <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between mb-3.5">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shop by Category</h2>
                        <Link href="/categories" className="text-emerald-600 text-xs sm:text-sm font-semibold hover:underline">
                            See All
                        </Link>
                    </div>
                    {/* Horizontal Scroll with Generated Images */}
                    <div className="flex overflow-x-auto pb-4 px-4 sm:px-8 gap-3 sm:gap-5 no-scrollbar snap-x">
                        {categories.map(cat => (
                            <CategoryCard key={cat.id} cat={cat} />
                        ))}
                    </div>
                </div>
            </section>

            {/* Recommended Products */}
            <section className="px-3 sm:px-6 lg:px-8 mt-6 sm:mt-8">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 px-1">Recommended for You</h2>

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



function getCategoryImage(name: string): string | null {
    const lowerName = name?.toLowerCase() || ''

    // Explicit priority checks
    if (lowerName.includes('industrial') || lowerName.includes('office') || lowerName.includes('stationery')) return CATEGORY_IMAGES['industrial']

    if (lowerName.includes('shoe') || lowerName.includes('footwear') || lowerName.includes('sandal')) return CATEGORY_IMAGES['footwear']
    if (lowerName.includes('fashion') || lowerName.includes('clothing') || lowerName.includes('wear')) return CATEGORY_IMAGES['fashion']

    if (lowerName.includes('beauty') || lowerName.includes('personal') || lowerName.includes('hair') || lowerName.includes('skin')) return CATEGORY_IMAGES['beauty']
    if (lowerName.includes('grocery') || lowerName.includes('fmcg') || lowerName.includes('food')) return CATEGORY_IMAGES['grocery']

    if (lowerName.includes('toy') || lowerName.includes('baby') || lowerName.includes('game')) return CATEGORY_IMAGES['toys']
    if (lowerName.includes('sport') || lowerName.includes('gym') || lowerName.includes('fitness')) return CATEGORY_IMAGES['sports']
    if (lowerName.includes('auto') || lowerName.includes('car') || lowerName.includes('bike')) return CATEGORY_IMAGES['automotive']

    // Hardware & Tools
    if (lowerName.includes('hardware') || lowerName.includes('tool') || lowerName.includes('drill') || lowerName.includes('construction')) return CATEGORY_IMAGES['hardware']

    // Electronics & Appliances split
    if (lowerName.includes('wash') || lowerName.includes('fridge') || lowerName.includes('conditioner') || lowerName.includes('appliance')) return CATEGORY_IMAGES['appliances']
    if (lowerName.includes('kitchen') || lowerName.includes('cook') || lowerName.includes('mixer')) return CATEGORY_IMAGES['kitchen']
    if (lowerName.includes('electronics') || lowerName.includes('mobile') || lowerName.includes('gadget')) return CATEGORY_IMAGES['electronics']

    if (lowerName.includes('home') || lowerName.includes('decor')) return CATEGORY_IMAGES['home']

    return null
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
                {generatedImg ? (
                    <img
                        src={generatedImg}
                        alt={cat.name}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                ) : cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl sm:text-3xl bg-gray-100">
                        {cat.name?.[0]?.toUpperCase()}
                    </div>
                )}
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
                <div className="mt-auto">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-emerald-700 font-bold text-sm sm:text-base">
                            {formatCurrency(product.display_price || product.base_price)}
                        </span>
                        {(product.display_price > product.base_price) && (
                            <span className="text-[10px] text-gray-400 line-through">
                                {formatCurrency(Math.round((product.display_price || product.base_price) * 1.2))}
                            </span>
                        )}
                    </div>

                    {/* Tiny Margin Text */}
                    <div className="mt-1 text-[10px] text-emerald-600 font-medium truncate">
                        Margin: ₹{Math.round(product.your_margin || (product.display_price * 0.15))}/pc
                    </div>
                </div>
            </div>
        </Link>
    )
}
