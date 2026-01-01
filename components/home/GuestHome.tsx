'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Package,
    ArrowRight,
    Loader2,
    Shield,
    Truck,
    CheckCircle,
    Store,
    TrendingUp
} from 'lucide-react'
import { getCategoryImage } from '@/utils/category'
import { formatCurrency } from '@/lib/utils'

export default function GuestHome() {
    const [categories, setCategories] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        // Fetch top level categories
        const { data: cats } = await supabase
            .from('categories')
            .select('*')
            .is('parent_id', null)
            .limit(10)

        // Fetch top products
        const { data: prods } = await supabase
            .from('products')
            .select('*, manufacturer:users!manufacturer_id(is_verified, business_name)')
            .eq('is_active', true)
            .limit(10)

        if (cats) setCategories(cats)
        if (prods) setProducts(prods)
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
                    {/* Featured Categories */}
                    <section className="py-12 md:py-16 bg-gray-50/50">
                        <div className="max-w-7xl mx-auto">
                            <div className="px-4 flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Browse Categories</h2>
                                    <p className="text-gray-500 text-sm mt-1">Discover products by industry</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="hidden md:flex gap-1.5">
                                        <button onClick={() => scroll('left')} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm">
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => scroll('right')} className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm">
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <Link href="/categories" className="text-emerald-600 font-bold hover:text-emerald-700 text-sm">
                                        See all
                                    </Link>
                                </div>
                            </div>

                            <div
                                ref={scrollContainerRef}
                                className="flex overflow-x-auto pb-4 px-4 gap-4 md:gap-6 no-scrollbar snap-x scroll-smooth"
                            >
                                {categories.map(cat => (
                                    <Link
                                        key={cat.id}
                                        href={`/products?category=${cat.slug}`}
                                        className="flex flex-col items-center min-w-[100px] md:min-w-[140px] snap-start group"
                                    >
                                        <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-3xl bg-white shadow-sm border border-gray-100 overflow-hidden flex items-center justify-center group-hover:shadow-xl group-hover:border-emerald-200 transition-all duration-300">
                                            {getCategoryImage(cat.name) ? (
                                                <img
                                                    src={getCategoryImage(cat.name)}
                                                    alt={cat.name}
                                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="text-2xl font-bold text-emerald-700">{cat.name?.[0]}</div>
                                            )}
                                        </div>
                                        <span className="mt-3 text-xs md:text-sm font-semibold text-gray-700 text-center uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                            {cat.name}
                                        </span>
                                    </Link>
                                ))}
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
                                    <Link
                                        key={product.id}
                                        href={`/products/${product.id}`}
                                        className="flex flex-col group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-2xl hover:border-emerald-100 transition-all duration-500"
                                    >
                                        <div className="aspect-[4/5] relative overflow-hidden bg-gray-50">
                                            {product.images?.[0] ? (
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-12 h-12 text-gray-200" />
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-tight">
                                                MOQ: {product.moq}
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col flex-1">
                                            <h3 className="font-bold text-gray-900 text-sm md:text-base mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                                                {product.name}
                                            </h3>
                                            <div className="mt-auto">
                                                <div className="text-lg font-black text-emerald-700">
                                                    {formatCurrency(product.display_price)}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">
                                                    <Sparkles className="w-3 h-3 text-emerald-500" />
                                                    Factory Direct
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
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
