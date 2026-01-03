'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { getMarketplaceData } from '@/app/actions/getMarketplaceData'
import { supabase } from '@/lib/supabase'
import {
    ChevronRight,
    ArrowRight,
    Loader2,
    Shield,
    Truck,
    CheckCircle,
    Store,
    TrendingUp
} from 'lucide-react'
import { ProductCard } from '@/components/product/ProductCard'
import Image from 'next/image'

interface GuestHomeProps {
    initialCategories?: any[]
    initialProducts?: any[]
}

export default function GuestHome({ initialCategories = [], initialProducts = [] }: GuestHomeProps) {
    const [categories, setCategories] = useState<any[]>(initialCategories)
    const [products, setProducts] = useState<any[]>(initialProducts)
    const [loading, setLoading] = useState(initialCategories.length === 0 && initialProducts.length === 0)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (initialProducts.length > 0) {
            console.log('GuestHome Mounted. Initial Products:', initialProducts.length)
            const hasVariants = initialProducts.some(p => p.parent_id)
            if (hasVariants) {
                console.warn('⚠️ Variants detected in initialProducts! Filtering them out...')
                setProducts(initialProducts.filter(p => !p.parent_id))
            }
        }
        if (initialCategories.length === 0 && initialProducts.length === 0) {
            fetchData()
        }
    }, [initialCategories, initialProducts])

    const fetchData = async () => {
        const { categories: cats, products: prods } = await getMarketplaceData()

        if (cats) setCategories(cats)
        if (prods) {
            const parentsOnly = (prods as any[]).filter(p => !p.parent_id)
            setProducts(parentsOnly)
        }
        setLoading(false)
    }

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef
            const scrollAmount = direction === 'left' ? -300 : 300
            current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white py-16 md:py-24 px-4">
                <div className="max-w-7xl mx-auto md:flex items-center justify-between gap-12">
                    <div className="md:w-1/2 space-y-6">
                        <div className="inline-block bg-emerald-700/50 backdrop-blur-sm border border-emerald-600/50 px-4 py-1.5 rounded-full text-sm font-medium">
                            🇮🇳 India's Direct Manufacturer Marketplace
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                            Source Directly from <br />
                            <span className="text-emerald-400 text-glow">Verified Factories</span>
                        </h1>
                        <p className="text-lg text-emerald-100/90 max-w-xl">
                            Wholesale prices without the middlemen. Secure payments, reliable logistics, and quality assurance for every B2B order.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <Link href="/register?type=retailer" className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-center transition-all hover:-translate-y-1 active:scale-95">
                                Join as Retailer
                            </Link>
                            <Link href="/register?type=manufacturer" className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white font-bold rounded-xl text-center transition-all active:scale-95">
                                Sell on D2BCart
                            </Link>
                        </div>
                    </div>

                    {/* Stats / Visual Block */}
                    <div className="hidden md:grid grid-cols-2 gap-4 md:w-1/2 max-w-md">
                        <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/10 hover:bg-white/20 transition-colors">
                            <TrendingUp className="w-8 h-8 text-emerald-400 mb-4" />
                            <div className="text-3xl font-bold">500+</div>
                            <div className="text-sm text-emerald-200">Verified Manufacturers</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/10 mt-8 hover:bg-white/20 transition-colors">
                            <Store className="w-8 h-8 text-emerald-400 mb-4" />
                            <div className="text-3xl font-bold">10k+</div>
                            <div className="text-sm text-emerald-200">Active Retailers</div>
                        </div>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                    <p className="text-gray-500 font-medium">Loading marketplace...</p>
                </div>
            ) : (
                <>
                    {/* Hierarchical Categories Section */}
                    <section className="pt-4 pb-8 md:pt-8 md:pb-12 bg-gray-50/50">
                        <div className="max-w-7xl mx-auto">


                            <div className="space-y-12">
                                {categories.filter(c => c.slug === 'mobile-accessories').map((parent) => {
                                    const children = categories.filter(c => c.parent_id === parent.id)
                                    // Always show if found, since we are explicitly targeting it.
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

                                {/* Also handle "Standalone" parents (no subcats) separately if needed? 
                                    User said "Mobile Accessories only", implying hierarchy. 
                                    I will include a fallback row for Active Categories that were NOT rendered above (i.e. orphans or parents without displayed children) if necessary.
                                    For now, let's Stick to Hierarchy as requested. 
                                */}
                            </div>
                        </div>
                    </section>

                    {/* Trending Products Grid */}
                    <section className="py-16 md:py-24 px-4 bg-white">
                        <div className="max-w-7xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Trending in Marketplace</h2>
                                <p className="text-gray-500 mt-2">Get direct factory rates for your retail store</p>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8">
                                {products.map(product => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>

                            <div className="mt-16 text-center">
                                <Link
                                    href="/products"
                                    className="inline-flex items-center gap-2 px-10 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-900/20 transition-all hover:-translate-y-1 active:scale-95"
                                >
                                    Browse All 1,000+ Products
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* Why Choose Us Section */}
            <section className="py-20 md:py-32 bg-gray-50 border-y border-gray-100">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-16 md:mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 tracking-tight">Built for Bharat's Modern Supply Chain</h2>
                        <p className="text-gray-600 mt-4 text-lg">Direct manufacturing to retail commerce platform</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12">
                        {[
                            {
                                icon: Shield,
                                title: "100% Verified Manufacturers",
                                desc: "Every seller goes through rigorous GST and physical warehouse verification checks."
                            },
                            {
                                icon: Truck,
                                title: "Reliable Nationwide Logistics",
                                desc: "Integrated shipping partners ensuring last-mile delivery to every corner of India."
                            },
                            {
                                icon: CheckCircle,
                                title: "Safe & Escrow Payments",
                                desc: "Your money stays safe until the manufacturer dispatches the quality-checked order."
                            }
                        ].map((feature, i) => (
                            <div key={i} className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-8">
                                    <feature.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                                <p className="text-gray-500 leading-relaxed text-lg">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="bg-emerald-900 rounded-[2.5rem] p-8 md:p-20 relative overflow-hidden">
                        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-8">
                            <h2 className="text-3xl md:text-6xl font-bold text-white leading-tight">
                                Ready to scale your <br />
                                <span className="text-emerald-400">Retail Business?</span>
                            </h2>
                            <p className="text-emerald-100/80 text-lg md:text-xl">
                                Join 10,000+ retailers sourcing smarter, direct from the source.
                                High margins, low costs, zero stress.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-6 pt-4">
                                <Link href="/register?type=retailer" className="px-12 py-5 bg-white text-emerald-900 font-black rounded-2xl shadow-2xl hover:bg-emerald-50 transition-all active:scale-95 text-xl">
                                    Join for Free
                                </Link>
                                <Link href="/products" className="px-12 py-5 bg-emerald-700 text-white font-black rounded-2xl shadow-2xl hover:bg-emerald-600 transition-all active:scale-95 text-xl border border-white/20">
                                    Explore Products
                                </Link>
                            </div>
                        </div>
                        {/* Abstract blobs for background decorative effect */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                    </div>
                </div>
            </section>
        </div>
    )
}
