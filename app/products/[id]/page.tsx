'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
    ArrowLeft,
    Package,
    MapPin,
    Phone,
    Building,
    ShoppingCart,
    Minus,
    Plus,
    Check,
    Shield,
    Bell
} from 'lucide-react'

export default function ProductDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)
    const [quantity, setQuantity] = useState(1)
    const [addingToCart, setAddingToCart] = useState(false)
    const [requested, setRequested] = useState(false)

    const { user, addToCart } = useStore()

    useEffect(() => {
        if (params.id) {
            fetchProduct(params.id as string)
            checkRequestStatus(params.id as string)
        }
    }, [params.id])

    const checkRequestStatus = async (productId: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('stock_requests')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .single()

        if (data) setRequested(true)
    }

    const handleNotifyMe = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            toast.error('Please login to get notified')
            router.push('/login')
            return
        }

        const { error } = await (supabase
            .from('stock_requests') as any)
            .insert({
                user_id: user.id,
                product_id: product?.id,
                status: 'pending'
            })

        if (!error) {
            setRequested(true)
            toast.success('We will notify you when stock is back!')
        }
    }

    const fetchProduct = async (id: string) => {
        setLoading(true)
        const { data, error } = await supabase
            .from('products')
            .select(`
        *,
        manufacturer:users!products_manufacturer_id_fkey(
          id, business_name, city, state, phone, is_verified
        ),
        category:categories!products_category_id_fkey(name, slug)
      `)
            .eq('id', id)
            .single()

        if (data) {
            setProduct(data as Product)
            setQuantity((data as Product).moq || 1)
        }
        setLoading(false)
    }

    const handleAddToCart = async () => {
        if (!user) {
            toast.error('Please login to add items to cart')
            router.push('/login')
            return
        }

        if (user.user_type !== 'retailer') {
            toast.error('Only retailers can place orders')
            return
        }

        if (!product) return

        setAddingToCart(true)
        addToCart(product, quantity)
        toast.success('Added to cart!')
        setAddingToCart(false)
    }

    const handleBuyNow = async () => {
        if (!user) {
            toast.error('Please login to place order')
            router.push('/login')
            return
        }

        if (!product) return

        addToCart(product, quantity)
        router.push('/cart')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <Package className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600">Product not found</h2>
                <Link href="/products" className="mt-4 text-emerald-600 hover:underline">
                    ← Back to products
                </Link>
            </div>
        )
    }

    const totalAmount = product.display_price * quantity

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Back Button */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Images */}
                    <div>
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                {product.images?.[0] ? (
                                    <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package className="w-24 h-24 text-gray-300" />
                                )}
                            </div>
                        </div>

                        {/* Thumbnail Gallery */}
                        {product.images && product.images.length > 1 && (
                            <div className="flex gap-2 mt-4 overflow-x-auto">
                                {product.images.map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
                                    >
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div>
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            {product.category && (
                                <span className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                                    {product.category.name}
                                </span>
                            )}

                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                                {product.name}
                            </h1>

                            <div className="flex items-baseline gap-3 mb-6">
                                <span className="text-4xl font-bold text-emerald-600">
                                    {formatCurrency(product.display_price)}
                                </span>
                                <span className="text-gray-500">per unit</span>
                            </div>

                            {product.description && (
                                <p className="text-gray-600 mb-6">{product.description}</p>
                            )}

                            <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-xl">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Minimum Order Qty</span>
                                    <span className="font-semibold">{product.moq} units</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Available Stock</span>
                                    <span className="font-semibold">{product.stock > 0 ? `${product.stock} units` : 'In Stock'}</span>
                                </div>
                            </div>

                            {/* Quantity Selector */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Quantity
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center border rounded-lg">
                                        <button
                                            onClick={() => setQuantity(Math.max(product.moq, quantity - 1))}
                                            className="p-3 hover:bg-gray-100 transition-colors"
                                        >
                                            <Minus className="w-5 h-5" />
                                        </button>
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Math.max(product.moq, parseInt(e.target.value) || product.moq))}
                                            className="w-20 text-center border-x py-3 focus:outline-none"
                                            min={product.moq}
                                        />
                                        <button
                                            onClick={() => setQuantity(quantity + 1)}
                                            className="p-3 hover:bg-gray-100 transition-colors"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Total: </span>
                                        <span className="text-xl font-bold text-emerald-600">
                                            {formatCurrency(totalAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {product.stock > 0 ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={addingToCart}
                                        className="flex-1 btn-outline flex items-center justify-center gap-2"
                                    >
                                        <ShoppingCart className="w-5 h-5" />
                                        Add to Cart
                                    </button>
                                    <button
                                        onClick={handleBuyNow}
                                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                                    >
                                        Buy Now
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleNotifyMe}
                                    disabled={requested}
                                    className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${requested
                                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        }`}
                                >
                                    {requested ? (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Request Sent
                                        </>
                                    ) : (
                                        <>
                                            <Bell className="w-5 h-5" />
                                            Notify Me When Available
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Manufacturer Info */}
                        {product.manufacturer && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm mt-6">
                                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <Building className="w-5 h-5 text-gray-400" />
                                    Manufacturer Details
                                </h3>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">
                                            {product.manufacturer.business_name}
                                        </span>
                                        {product.manufacturer.is_verified && (
                                            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Shield className="w-3 h-3" />
                                                Verified
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-gray-600">
                                        <MapPin className="w-4 h-4" />
                                        {product.manufacturer.city}, {product.manufacturer.state}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Trust Indicators */}
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <Shield className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                <div className="text-sm font-medium">Secure Payment</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <Check className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                <div className="text-sm font-medium">Quality Assured</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <Package className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                <div className="text-sm font-medium">Direct Shipping</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
