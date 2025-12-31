'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Star } from 'lucide-react'

// Helper to shuffle array for "random" feed
const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5)

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
            .eq('level', 0)
            .limit(10)

        // Fetch featured products
        const { data: prods } = await supabase
            .from('products')
            .select('*')
            .limit(20)

        if (cats) setCategories(cats)
        if (prods) setProducts(shuffle(prods))
        setLoading(false)
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Loading your feed...</div>

    return (
        <div className="pb-20 md:pb-8">
            {/* Banner Slider (Static for now) */}
            <div className="px-4 py-4 md:py-6">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 md:p-10 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl md:text-4xl font-bold mb-2">Summer Collection Sale</h2>
                        <p className="mb-4 text-indigo-100">Get up to 40% margin on bulk orders.</p>
                        <Link href="/products" className="bg-white text-indigo-600 px-6 py-2 rounded-full font-bold text-sm hover:bg-indigo-50 transition-colors">
                            Explore Now
                        </Link>
                    </div>
                    {/* Abstract Circle */}
                    <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            </div>

            {/* Categories Rail */}
            <div className="px-4 mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-900">Top Categories</h3>
                    <Link href="/categories" className="text-emerald-600 text-sm font-medium hover:underline">View All</Link>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 snap-x">
                    {categories.map(cat => (
                        <Link
                            key={cat.id}
                            href={`/products?category=${cat.slug}`}
                            className="flex flex-col items-center min-w-[80px] snap-start group"
                        >
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full mb-2 overflow-hidden border border-gray-200 group-hover:border-emerald-500 transition-colors">
                                {cat.image_url ? (
                                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Img</div>
                                )}
                            </div>
                            <span className="text-xs text-center text-gray-700 font-medium line-clamp-2 md:line-clamp-1 group-hover:text-emerald-600">
                                {cat.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* "For You" Feed */}
            <div className="px-4">
                <h3 className="font-bold text-lg text-gray-900 mb-4">Recommended for You</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {products.map(product => (
                        <Link
                            key={product.id}
                            href={`/products/${product.id}`}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                        >
                            <div className="aspect-square bg-gray-100 relative">
                                {product.image_url && (
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-gray-600">
                                    MOQ: {product.moq}
                                </div>
                            </div>
                            <div className="p-3 flex flex-col flex-1">
                                <h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{product.name}</h4>
                                <div className="mt-auto">
                                    <p className="text-xs text-gray-500 line-through">₹{Math.round(product.price * 1.2)}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-emerald-600 font-bold">₹{product.price}</p>
                                        <div className="flex items-center gap-1 text-[10px] text-orange-500 font-medium">
                                            <Star className="w-3 h-3 fill-orange-500" />
                                            <span>4.5</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-center bg-green-50 text-green-700 py-1 rounded">
                                        Your Margin: {product.margin_percentage}%
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
