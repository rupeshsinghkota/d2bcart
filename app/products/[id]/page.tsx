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
    const [activeImageIndex, setActiveImageIndex] = useState(0)

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
        <div className="min-h-screen bg-gray-50 pb-32 md:pb-8">
            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200/50 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <h1 className="font-semibold text-gray-900 truncate flex-1">{product.name}</h1>
            </div>

            {/* Desktop Back Button */}
            <div className="hidden md:block bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Products
                    </button>
                </div>
            </div>

            {/* Breadcrumbs */}
            <div className="max-w-7xl mx-auto px-4 pt-3 md:pt-4">
                <nav className="flex items-center gap-2 text-sm text-gray-500 overflow-x-auto no-scrollbar">
                    <Link href="/products" className="hover:text-emerald-600 transition-colors whitespace-nowrap">Products</Link>
                    {product.category && (
                        <>
                            <span className="text-gray-300">/</span>
                            <Link
                                href={`/products?category=${product.category.slug}`}
                                className="hover:text-emerald-600 transition-colors whitespace-nowrap"
                            >
                                {product.category.name}
                            </Link>
                        </>
                    )}
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-700 font-medium truncate">{product.name}</span>
                </nav>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
                <div className="grid md:grid-cols-2 gap-6 md:gap-10">
                    {/* Images Section */}
                    <div className="space-y-4">
                        {/* Main Image */}
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                            <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
                                {product.images?.[activeImageIndex] ? (
                                    <img
                                        src={product.images[activeImageIndex]}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package className="w-24 h-24 text-gray-300" />
                                )}
                                {product.category && (
                                    <Link
                                        href={`/products?category=${product.category.slug}`}
                                        className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 shadow-sm border border-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                    >
                                        {product.category.name}
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Thumbnail Gallery */}
                        {product.images && product.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {product.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImageIndex(idx)}
                                        className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border-2 transition-all cursor-pointer ${activeImageIndex === idx ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-transparent hover:border-emerald-300'}`}
                                    >
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Trust Indicators - Desktop Only */}
                        <div className="hidden md:grid grid-cols-3 gap-3 mt-6">
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
                                <Shield className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                                <div className="text-xs font-medium text-gray-700">Secure Payment</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
                                <Check className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                                <div className="text-xs font-medium text-gray-700">Quality Assured</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
                                <Package className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                                <div className="text-xs font-medium text-gray-700">Direct Shipping</div>
                            </div>
                        </div>
                    </div>

                    {/* Product Info Section */}
                    <div className="space-y-4">
                        {/* Main Product Card */}
                        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
                            <h1 className="hidden md:block text-2xl md:text-3xl font-bold text-gray-900 mb-3 leading-tight">
                                {product.name}
                            </h1>

                            {/* Price */}
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-3xl md:text-4xl font-bold text-gray-900">
                                    {formatCurrency(product.display_price)}
                                </span>
                                <span className="text-gray-500 text-sm">/unit</span>
                            </div>

                            {product.description && (
                                <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-5 border-b border-gray-100 pb-5">
                                    {product.description}
                                </p>
                            )}

                            {/* Product Specs */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <div className="text-xs text-gray-500 mb-1">Min. Order</div>
                                    <div className="font-bold text-gray-900">{product.moq} units</div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <div className="text-xs text-gray-500 mb-1">Stock</div>
                                    <div className="font-bold text-gray-900">{product.stock > 0 ? `${product.stock} units` : 'Available'}</div>
                                </div>
                            </div>

                            {/* Quantity Selector - Desktop */}
                            <div className="hidden md:block mb-5">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Quantity
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setQuantity(Math.max(product.moq, quantity - 1))}
                                            className="p-3 hover:bg-gray-200 transition-colors"
                                        >
                                            <Minus className="w-5 h-5 text-gray-600" />
                                        </button>
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Math.max(product.moq, parseInt(e.target.value) || product.moq))}
                                            className="w-16 text-center bg-transparent py-3 font-semibold focus:outline-none"
                                            min={product.moq}
                                        />
                                        <button
                                            onClick={() => setQuantity(quantity + 1)}
                                            className="p-3 hover:bg-gray-200 transition-colors"
                                        >
                                            <Plus className="w-5 h-5 text-gray-600" />
                                        </button>
                                    </div>
                                    <div className="flex-1 text-right">
                                        <span className="text-gray-500 text-sm">Total: </span>
                                        <span className="text-2xl font-bold text-emerald-600">
                                            {formatCurrency(totalAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Desktop Action Buttons */}
                            {product.stock > 0 ? (
                                <div className="hidden md:flex gap-3">
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={addingToCart}
                                        className="flex-1 py-3.5 px-6 border-2 border-emerald-600 text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <ShoppingCart className="w-5 h-5" />
                                        Add to Cart
                                    </button>
                                    <button
                                        onClick={handleBuyNow}
                                        className="flex-1 py-3.5 px-6 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                                    >
                                        Buy Now
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleNotifyMe}
                                    disabled={requested}
                                    className={`hidden md:flex w-full py-3.5 rounded-xl items-center justify-center gap-2 font-semibold transition-colors ${requested
                                        ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        }`}
                                >
                                    {requested ? (
                                        <><Check className="w-5 h-5" /> Request Sent</>
                                    ) : (
                                        <><Bell className="w-5 h-5" /> Notify Me When Available</>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Manufacturer Info Card */}
                        {product.manufacturer && (
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Building className="w-5 h-5 text-gray-400" />
                                    Seller Information
                                </h3>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-gray-900">
                                                {product.manufacturer.business_name}
                                            </span>
                                            {product.manufacturer.is_verified && (
                                                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                                                    <Shield className="w-3 h-3" />
                                                    Verified
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                            <MapPin className="w-4 h-4" />
                                            {product.manufacturer.city}, {product.manufacturer.state}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Bottom Action Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 p-4 z-40 safe-area-inset-bottom">
                <div className="flex items-center gap-3">
                    {/* Quantity Selector */}
                    <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden shrink-0">
                        <button
                            onClick={() => setQuantity(Math.max(product.moq, quantity - 1))}
                            className="p-3 hover:bg-gray-200"
                        >
                            <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="w-10 text-center font-semibold">{quantity}</span>
                        <button
                            onClick={() => setQuantity(quantity + 1)}
                            className="p-3 hover:bg-gray-200"
                        >
                            <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>

                    {/* Action Buttons */}
                    {product.stock > 0 ? (
                        <>
                            <button
                                onClick={handleAddToCart}
                                disabled={addingToCart}
                                className="flex-1 py-3 border-2 border-emerald-600 text-emerald-600 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <ShoppingCart className="w-4 h-4" />
                                <span className="hidden xs:inline">Cart</span>
                            </button>
                            <button
                                onClick={handleBuyNow}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
                            >
                                Buy - {formatCurrency(totalAmount)}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleNotifyMe}
                            disabled={requested}
                            className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${requested
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-emerald-600 text-white'
                                }`}
                        >
                            <Bell className="w-4 h-4" />
                            {requested ? 'Notified' : 'Notify Me'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
