'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Package, MapPin, Trash2, ShoppingCart } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function WishlistPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const { addToCart } = useStore()
    const router = useRouter()

    useEffect(() => {
        fetchWishlist()
    }, [])

    const fetchWishlist = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('wishlists')
            .select(`
                product:products (
                    *,
                    manufacturer:users!products_manufacturer_id_fkey(business_name, city),
                    category:categories!products_category_id_fkey(name)
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (data) {
            setProducts(data.map((item: any) => item.product))
        }
        setLoading(false)
    }

    const removeFromWishlist = async (e: React.MouseEvent, productId: string) => {
        e.preventDefault()
        e.stopPropagation()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('wishlists')
            .delete()
            .match({ user_id: user.id, product_id: productId })

        if (!error) {
            setProducts(prev => prev.filter(p => p.id !== productId))
            toast.success('Removed from wishlist')
        }
    }

    const handleAddToCart = (e: React.MouseEvent, product: Product) => {
        e.preventDefault()
        e.stopPropagation()
        addToCart(product, product.moq)
        toast.success('Added to cart')
        router.push('/cart')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/retailer"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">My Wishlist</h1>
                    <p className="text-gray-600">Saved items for later</p>
                </div>

                {products.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-600 mb-2">
                            Your wishlist is empty
                        </h2>
                        <p className="text-gray-500 mb-6">
                            Start exploring products and save them for later
                        </p>
                        <Link href="/products" className="btn-primary inline-block">
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {products.map(product => (
                            <div key={product.id} className="relative group">
                                <Link
                                    href={`/products/${product.slug || product.id}`}
                                    className="block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all"
                                >
                                    {/* Image */}
                                    <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                                        {product.images?.[0] ? (
                                            <Image
                                                src={product.images[0]}
                                                alt={product.name}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform"
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

                                        <div className="mt-4 pt-4 border-t flex gap-2">
                                            <button
                                                onClick={(e) => handleAddToCart(e, product)}
                                                className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-2"
                                            >
                                                <ShoppingCart className="w-4 h-4" />
                                                Add to Cart
                                            </button>
                                        </div>
                                    </div>
                                </Link>
                                <button
                                    onClick={(e) => removeFromWishlist(e, product.id)}
                                    className="absolute top-3 right-3 p-2 bg-white/90 rounded-full shadow-sm text-gray-400 hover:text-red-500 transition-colors z-10"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
