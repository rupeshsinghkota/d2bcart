'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ChevronRight, ChevronLeft, Sparkles, TrendingUp, Percent, Zap, Package, Star, ArrowRight, Loader2, Plus } from 'lucide-react'
import { getCategoryImage } from '@/utils/category'
import { formatCurrency } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { toast } from 'react-hot-toast'
import { ProductCard } from '@/components/product/ProductCard'
import Image from 'next/image'

// Helper to shuffle array for "random" feed
const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5)

interface RetailerHomeProps {
    initialCategories?: any[]
    initialProducts?: any[]
    user?: any
}

export default function RetailerHome({ initialCategories = [], initialProducts = [], user }: RetailerHomeProps) {
    const [categories, setCategories] = useState<any[]>(initialCategories)
    const [products, setProducts] = useState<any[]>(initialProducts)
    const [loading, setLoading] = useState(initialCategories.length === 0 && initialProducts.length === 0)
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
        console.log('RetailerHome Mounted. Initial Products:', initialProducts.length)
        if (initialProducts.length > 0) {
            const hasVariants = initialProducts.some(p => p.parent_id)
            if (hasVariants) {
                console.warn('⚠️ Variants detected in initialProducts! Filtering them out...')
                setProducts(initialProducts.filter(p => !p.parent_id))
            }
        }
        fetchData()
    }, [])

    const fetchData = async () => {
        // Fetch products
        await fetchProducts(1)
    }

    const fetchProducts = async (pageNum: number) => {
        const from = (pageNum - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        const { data: prods } = await supabase
            .from('products')
            .select('*, manufacturer:users!products_manufacturer_id_fkey(is_verified, business_name)')
            .eq('is_active', true)
            .is('parent_id', null)
            .range(from, to)

        if (prods) {
            // Redundant filter to be 100% sure variations are excluded
            const parentsOnly = prods.filter((p: any) => !p.parent_id)
            const verified = parentsOnly.filter((p: any) => p.manufacturer?.is_verified)
            // Mix verified and unverified for variety, but prioritize verified
            const newProds = shuffle(verified.length > 0 ? verified : parentsOnly)

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
                                {user ? (
                                    <>
                                        <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold text-white mb-1.5 leading-tight">
                                            Welcome back, <br />
                                            <span className="text-emerald-200">{user.business_name}</span>
                                        </h1>
                                        <p className="text-emerald-50 text-[10px] sm:text-sm md:text-base mb-3 max-w-md opacity-90 leading-relaxed">
                                            Continue sourcing from 500+ verified factories.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold text-white mb-1.5 leading-tight">
                                            Maximize Your <span className="text-emerald-200">Profits</span>
                                        </h1>
                                        <p className="text-emerald-50 text-[10px] sm:text-sm md:text-base mb-3 max-w-md opacity-90 leading-relaxed line-clamp-1 sm:line-clamp-none">
                                            Direct from 500+ verified factories. Save big.
                                        </p>
                                    </>
                                )}
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



            {/* Hierarchical Categories Section */}
            <section className="pt-4 pb-8 md:pt-8 md:pb-12 bg-gray-50/50">
                <div className="max-w-7xl mx-auto">
                    <div className="space-y-12">
                        {categories.filter(c => c.slug === 'mobile-accessories').map((parent) => {
                            const children = categories.filter(c => c.parent_id === parent.id)
                            const itemsToShow = children.length > 0 ? children : [parent]
                            const isBranch = children.length > 0

                            return (
                                <div key={parent.id} className="relative group/section py-6">
                                    {/* Section Header */}
                                    <div className="px-4 md:px-0 flex items-end justify-between mb-6">
                                        <div>
                                            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                                                {parent.name}
                                            </h3>
                                            {isBranch && (
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {children.length} collections
                                                </p>
                                            )}
                                        </div>
                                        <Link
                                            href={`/products?category=${parent.slug}`}
                                            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group/link"
                                        >
                                            View All
                                            <ChevronRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
                                        </Link>
                                    </div>

                                    {/* Horizontal Scroll Container */}
                                    <div className="flex overflow-x-auto pb-4 px-3 gap-4 md:gap-6 md:px-4 no-scrollbar snap-x scroll-padding-x-4">
                                        {itemsToShow.map(child => (
                                            <Link
                                                key={child.id}
                                                href={`/products?category=${child.slug}`}
                                                className="snap-start shrink-0 w-20 md:w-24 group cursor-pointer flex flex-col items-center gap-2"
                                            >
                                                {/* Circular Image Container */}
                                                <div className="w-16 h-16 md:w-20 md:h-20 relative rounded-full overflow-hidden bg-gray-100 shadow-sm ring-2 ring-gray-100 group-hover:ring-emerald-500 transition-all duration-300 group-hover:shadow-md group-hover:scale-105">
                                                    {child.image_url ? (
                                                        <Image
                                                            src={child.image_url}
                                                            alt={child.name}
                                                            fill
                                                            className="object-cover"
                                                            sizes="(max-width: 768px) 64px, 80px"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-emerald-600 font-bold text-xl">
                                                            {child.name.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Text Label */}
                                                <span className="text-xs md:text-sm font-medium text-gray-700 text-center line-clamp-2 leading-tight group-hover:text-emerald-700 transition-colors">
                                                    {child.name}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
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
                        <Image
                            src={generatedImg}
                            alt={cat.name}
                            fill
                            sizes="(max-width: 640px) 72px, 90px"
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                        />
                    )
                    if (cat.image_url) return (
                        <Image src={cat.image_url} alt={cat.name} fill className="w-full h-full object-cover" />
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

// ProductCard is now imported from @/components/product/ProductCard
