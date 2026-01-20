'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DownloadCatalogButton from '@/components/catalog/DownloadCatalogButton'
import { MarketingTimer } from '@/components/marketing/MarketingTimer'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import Image from 'next/image'
import {
    ArrowLeft,
    Package,
    MapPin,
    Building,
    ShoppingCart,
    Minus,
    Plus,
    Check,
    Shield,
    Bell,
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ShieldCheck,
    Menu
} from 'lucide-react'
import dynamic from 'next/dynamic'
import DeliveryChecker from '@/components/product/DeliveryChecker'
import TrustPolicy from '@/components/product/TrustPolicy'

import { useProductTracking } from '@/hooks/useProductTracking'

const MobileMenu = dynamic(() => import('@/components/MobileMenu'), { ssr: false })

interface ProductDetailClientProps {
    product: Product
    manufacturerProducts: Product[]
    variations?: Product[]
}

export default function ProductDetailClient({ product, manufacturerProducts, variations = [] }: ProductDetailClientProps) {
    // Integrate Intelligent Tracking
    useProductTracking(product.id)

    const router = useRouter()
    const searchParams = useSearchParams()

    const [currentProduct, setCurrentProduct] = useState<Product>(product)
    const [quantity, setQuantity] = useState(1)
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [addingToCart, setAddingToCart] = useState(false)
    const [requested, setRequested] = useState(false)
    const [activeImageIndex, setActiveImageIndex] = useState(0)
    const [lightboxOpen, setLightboxOpen] = useState(false)

    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const { user, cart, addToCart } = useStore()

    // Handle Deep Linking from Google Shopping
    useEffect(() => {
        const variantId = searchParams.get('variant')
        if (variantId && variations.length > 0) {
            const targetVariant = variations.find(v => v.id === variantId)
            if (targetVariant) {
                // Pre-select the variant by setting its quantity to MOQ
                setQuantities(prev => ({
                    ...prev,
                    [targetVariant.id]: targetVariant.moq || 1
                }))
                // Optional: Scroll to variant section logic could go here
                toast.success('Variant pre-selected from link')
            }
        }
    }, [searchParams, variations])

    useEffect(() => {
        if (currentProduct?.id) {
            checkRequestStatus(currentProduct.id)
            if (variations.length === 0) {
                setQuantity(currentProduct.moq || 1)
            }
        }
    }, [currentProduct])

    const handleQuantityChange = (id: string, newQty: number, moq: number) => {
        if (newQty < 0) return
        setQuantities(prev => ({
            ...prev,
            [id]: newQty
        }))
    }

    const getTotalSelectedItems = () => {
        return Object.values(quantities).reduce((acc, output) => acc + output, 0)
    }

    const getTotalPrice = () => {
        if (variations.length > 0) {
            return variations.reduce((acc, v) => {
                const qty = quantities[v.id] || 0
                return acc + (v.display_price * qty)
            }, 0)
        }
        return currentProduct.display_price * quantity
    }

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
                product_id: currentProduct?.id,
                status: 'pending'
            })

        if (!error) {
            setRequested(true)
            toast.success('We will notify you when stock is back!')
        }
    }

    // Facebook Pixel: ViewContent
    useEffect(() => {
        import('@/lib/fpixel').then((fpixel) => {
            fpixel.event('ViewContent', {
                content_name: currentProduct.name,
                content_ids: [currentProduct.id],
                content_type: 'product',
                value: currentProduct.display_price,
                currency: 'INR',
            })
        })
    }, [currentProduct])

    const handleAddToCart = async () => {
        setAddingToCart(true)

        // Facebook Pixel: AddToCart
        import('@/lib/fpixel').then((fpixel) => {
            fpixel.event('AddToCart', {
                content_name: currentProduct.name,
                content_ids: variations.length > 0
                    ? variations.filter(v => (quantities[v.id] || 0) > 0).map(v => v.id)
                    : [currentProduct.id],
                content_type: 'product',
                value: getTotalPrice(),
                currency: 'INR',
            })
        })

        if (variations.length > 0) {
            // Bulk Add
            let addedCount = 0
            for (const v of variations) {
                const qty = quantities[v.id] || 0
                if (qty > 0) {
                    addToCart(v, qty)
                    addedCount++
                }
            }
            if (addedCount > 0) {
                toast.success(`${addedCount} types added to cart!`)
                // Reset quantities
                setQuantities({})
            } else {
                toast.error('Please select at least one item')
            }
        } else {
            // Single Product Add
            if (!currentProduct) return
            addToCart(currentProduct, quantity)
            toast.success('Added to cart!')
        }

        setAddingToCart(false)
    }

    const handleBuyNow = async () => {
        await handleAddToCart()
        router.push('/cart')
    }

    const totalDisplayPrice = getTotalPrice()

    return (
        <div className="min-h-screen bg-gray-50 pb-32 md:pb-8">
            {/* Mobile Header (App Bar Style) */}
            <div className="md:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-4 h-14 flex items-center justify-between transition-all duration-300">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-800" />
                    </button>

                    <div className="flex flex-col min-w-0">
                        <h1 className="font-bold text-sm text-gray-900 truncate leading-tight">
                            {currentProduct.name}
                        </h1>
                        {currentProduct.category && (
                            <span className="text-[10px] font-medium text-emerald-600 truncate leading-none mt-0.5">
                                {currentProduct.category.name}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {currentProduct.category && (
                        <div className="mr-1">
                            <DownloadCatalogButton
                                categoryId={currentProduct.category_id}
                                categoryName={currentProduct.category.name}
                                source="product"
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 h-auto"
                            />
                        </div>
                    )}
                    <button
                        onClick={() => router.push('/cart')}
                        className="p-2 -mr-1 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors relative"
                    >
                        <ShoppingCart className="w-5 h-5 text-gray-700" />
                        {cart.length > 0 && (
                            <span className="absolute top-1 right-0.5 bg-emerald-600 text-white text-[9px] font-bold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center border border-white">
                                {cart.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="p-2 -mr-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors relative"
                    >
                        <Menu className="w-5 h-5 text-gray-700" />
                    </button>
                </div>
            </div>

            <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

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

            {/* Breadcrumbs (Desktop Only) */}
            <div className="hidden md:block max-w-7xl mx-auto px-4 pt-4">
                <div className="flex items-center justify-between">
                    <nav className="flex items-center gap-2 text-sm text-gray-500">
                        <Link href="/products" className="hover:text-emerald-600 transition-colors whitespace-nowrap">Products</Link>
                        {currentProduct.category && (
                            <>
                                <span className="text-gray-300">/</span>
                                <Link
                                    href={`/products?category=${currentProduct.category.slug}`}
                                    className="hover:text-emerald-600 transition-colors whitespace-nowrap"
                                >
                                    {currentProduct.category.name}
                                </Link>
                            </>
                        )}
                        <span className="text-gray-300">/</span>
                        <span className="text-gray-700 font-medium truncate max-w-[300px]">{currentProduct.name}</span>
                    </nav>

                    {currentProduct.category && (
                        <div className="shrink-0">
                            <DownloadCatalogButton
                                categoryId={currentProduct.category_id}
                                categoryName={currentProduct.category.name}
                                source="product"
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto md:px-4 pb-4 md:py-8">
                <div className="grid grid-cols-1 md:grid-cols-[50%_45%] lg:grid-cols-[45%_50%] gap-6 lg:gap-12 items-start">
                    {/* Images Section */}
                    <div className="md:sticky md:top-24">
                        {/* Mobile: Horizontal Scroll Snap Gallery */}
                        <div className="md:hidden relative w-full bg-white">
                            <div
                                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar aspect-[4/3] touch-pan-x"
                                onScroll={(e) => {
                                    const scrollLeft = e.currentTarget.scrollLeft;
                                    const width = e.currentTarget.offsetWidth;
                                    const index = Math.round(scrollLeft / width);
                                    setActiveImageIndex(index);
                                }}
                            >
                                {(currentProduct.images?.length ? currentProduct.images : ['']).map((img, idx) => (
                                    <div
                                        key={idx}
                                        className="w-full flex-shrink-0 snap-center relative h-full flex items-center justify-center bg-white"
                                        onClick={() => setLightboxOpen(true)}
                                    >
                                        {img ? (
                                            <Image
                                                src={img}
                                                alt={`${currentProduct.name} - ${idx + 1}`}
                                                fill
                                                priority={idx === 0}
                                                className="object-contain"
                                            />
                                        ) : (
                                            <Package className="w-12 h-12 text-gray-200" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Mobile Pagination Dots */}
                            {currentProduct.images && currentProduct.images.length > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                                    {currentProduct.images.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`rounded-full transition-all shadow-sm ${activeImageIndex === idx ? 'w-2 h-2 bg-emerald-600' : 'w-2 h-2 bg-gray-300/80'
                                                }`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Mobile Image Count Badge - Hidden for cleaner look, dots are enough */}
                        </div>

                        {/* Desktop: Standard Gallery (Hidden on Mobile) */}
                        <div className="hidden md:block space-y-4">
                            <div className="relative aspect-square w-full max-w-[500px] mx-auto bg-gray-50 rounded-2xl overflow-hidden shadow-sm border border-gray-100 group">
                                <button
                                    onClick={() => currentProduct.images?.length && setLightboxOpen(true)}
                                    className="absolute inset-0 w-full h-full flex items-center justify-center p-4 cursor-zoom-in"
                                >
                                    {currentProduct.images?.[activeImageIndex] ? (
                                        <Image
                                            src={currentProduct.images[activeImageIndex]}
                                            alt={currentProduct.name}
                                            fill
                                            priority
                                            className="object-contain transition-opacity duration-300"
                                        />
                                    ) : (
                                        <Package className="w-24 h-24 text-gray-300" />
                                    )}
                                </button>
                            </div>

                            {/* Desktop Thumbnails */}
                            {currentProduct.images && currentProduct.images.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar justify-center">
                                    {currentProduct.images.map((img, idx) => {
                                        if (!img) return null
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setActiveImageIndex(idx)}
                                                className={`relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border-2 transition-all cursor-pointer ${activeImageIndex === idx ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-transparent hover:border-emerald-300'}`}
                                            >
                                                <Image
                                                    src={img}
                                                    alt={`Thumbnail ${idx + 1}`}
                                                    fill
                                                    sizes="64px"
                                                    className="object-cover"
                                                />
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Information, Manufacturer, and Related Products */}
                    <div className="space-y-6 md:space-y-8">
                        {/* Main Product Card */}
                        <div className="space-y-4 px-3 md:px-0">
                            {/* Product Header */}
                            {/* Product Header */}
                            <div className="mb-3">
                                <h1 className="text-xl md:text-3xl font-extrabold text-gray-900 mb-1 leading-tight">
                                    {currentProduct.name}
                                </h1>

                                {/* PRICE DISPLAY */}
                                {variations.length === 0 ? (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl md:text-4xl font-black text-emerald-600 tracking-tight">
                                                {formatCurrency(totalDisplayPrice)}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-400">
                                                for {quantity} {quantity === 1 ? 'Unit' : 'Units'}
                                            </span>
                                        </div>
                                        <div className="text-xs font-medium text-gray-500">
                                            {formatCurrency(currentProduct.display_price)} / unit
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        {totalDisplayPrice > 0 ? (
                                            <>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-2xl md:text-5xl font-black text-emerald-600 tracking-tight">
                                                        {formatCurrency(totalDisplayPrice)}
                                                    </span>
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        Total
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 font-medium">
                                                    {getTotalSelectedItems()} items selected
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-xl md:text-4xl font-bold text-gray-900 tracking-tight">
                                                        {formatCurrency(
                                                            (variations && variations.length > 0
                                                                ? Math.min(...variations.map(v => v.display_price * (v.moq || 1)))
                                                                : (currentProduct.display_price || currentProduct.base_price) * (currentProduct.moq || 1))
                                                        )}
                                                    </span>
                                                    <span className="text-xs font-medium text-gray-500">
                                                        / starting pack
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>





                            {/* BULK VARIATION GRID */}
                            {variations.length > 0 ? (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs md:text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-emerald-600" />
                                            Select Models
                                        </label>
                                        <span className="text-[10px] md:text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">
                                            {variations.length} Available
                                        </span>
                                    </div>

                                    {/* Scrollable Grid Container */}
                                    <div className="max-h-[450px] overflow-y-auto pr-1 custom-scrollbar -mr-1">
                                        <div className="grid grid-cols-2 gap-2 pb-2">
                                            {variations.map(v => {
                                                const qty = quantities[v.id] || 0
                                                const isActive = qty > 0

                                                return (
                                                    <div
                                                        key={v.id}
                                                        className={`
                                                            group relative p-2.5 md:p-3 rounded-xl border-2 transition-all duration-200
                                                            ${isActive
                                                                ? 'border-emerald-500 bg-emerald-50/50 shadow-md'
                                                                : 'border-gray-100 bg-white hover:border-emerald-200 hover:shadow-sm'
                                                            }
                                                        `}
                                                    >
                                                        {/* Card Header: Name & Price */}
                                                        <div className="flex justify-between items-start mb-2 md:mb-3 gap-2">
                                                            <div className="min-w-0">
                                                                <div className={`font-bold text-xs md:text-sm truncate ${isActive ? 'text-emerald-900' : 'text-gray-900'}`}>
                                                                    {(() => {
                                                                        const parentName = currentProduct.name.trim()
                                                                        const varName = v.name.trim()
                                                                        if (varName.toLowerCase().startsWith(parentName.toLowerCase())) {
                                                                            let cleanName = varName.substring(parentName.length).trim()
                                                                            cleanName = cleanName.replace(/^[-\s]+/, '')
                                                                            return cleanName || varName
                                                                        }
                                                                        return varName
                                                                    })()}
                                                                </div>
                                                                <div className="text-[10px] md:text-xs font-medium text-gray-500 mt-0.5">
                                                                    {formatCurrency(v.display_price)}
                                                                </div>
                                                            </div>
                                                            {isActive && (
                                                                <div className="shrink-0">
                                                                    <div className="w-4 h-4 md:w-5 md:h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                                        <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Card Footer: Quantity & MOQ */}
                                                        <div className="flex items-end justify-between gap-1.5 md:gap-2">
                                                            <div className="text-[9px] md:text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                                                Min: {v.moq || 1}
                                                            </div>

                                                            <div className={`flex items-center rounded-lg border shadow-sm overflow-hidden h-7 md:h-8 ${isActive ? 'bg-white border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                                                <button
                                                                    onClick={() => handleQuantityChange(v.id, qty - (v.moq || 1), v.moq || 1)}
                                                                    disabled={qty <= 0}
                                                                    className="w-7 md:w-8 h-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 transition-colors border-r border-gray-100/50"
                                                                >
                                                                    <Minus className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-600" />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    value={qty}
                                                                    step={v.moq || 1}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value) || 0
                                                                        handleQuantityChange(v.id, val, v.moq || 1)
                                                                    }}
                                                                    className={`w-8 md:w-10 text-center text-xs md:text-sm font-bold focus:outline-none ${isActive ? 'text-emerald-600' : 'text-gray-700'} bg-transparent`}
                                                                />
                                                                <button
                                                                    onClick={() => handleQuantityChange(v.id, qty + (v.moq || 1), v.moq || 1)}
                                                                    className="w-7 md:w-8 h-full flex items-center justify-center hover:bg-emerald-50 text-emerald-600 transition-colors border-l border-gray-100/50"
                                                                >
                                                                    <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-center md:hidden">
                                        <p className="text-[10px] text-emerald-600 font-medium animate-pulse flex items-center justify-center gap-1">
                                            <ChevronRight className="w-2.5 h-2.5 rotate-90" />
                                            More models below
                                            <ChevronRight className="w-2.5 h-2.5 rotate-90" />
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                // SINGLE PRODUCT QUANTITY SELECTOR
                                <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <label className="block text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">
                                        Select Quantity
                                    </label>
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-gray-500 font-medium">
                                            Min Order: {currentProduct.moq || 1} units
                                        </div>

                                        <div className="flex items-center bg-white rounded-full shadow-sm border border-gray-200 p-1">
                                            <button
                                                onClick={() => setQuantity(Math.max(currentProduct.moq || 1, quantity - (currentProduct.moq || 1)))}
                                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                                            >
                                                <Minus className="w-5 h-5" />
                                            </button>
                                            <input
                                                type="number"
                                                value={quantity}
                                                step={currentProduct.moq || 1}
                                                onChange={(e) => setQuantity(Math.max(currentProduct.moq || 1, parseInt(e.target.value) || currentProduct.moq || 1))}
                                                className="w-16 text-center text-lg font-bold text-gray-900 bg-transparent focus:outline-none"
                                                min={currentProduct.moq || 1}
                                            />
                                            <button
                                                onClick={() => setQuantity(quantity + (currentProduct.moq || 1))}
                                                className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition-colors"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Delivery Checker */}
                            <div className="mb-6">
                                <DeliveryChecker
                                    manufacturerId={currentProduct.manufacturer_id}
                                    weight={0.5}
                                    dimensions={{ length: 10, breadth: 10, height: 10 }}
                                />
                            </div>

                            {/* Trust Badge / Offer Highlight (Moved) */}
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-6 flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-emerald-900">Pay Shipping Only & Confirm Order</p>
                                        <p className="text-xs text-emerald-700">Pay only shipping charges now. Pay the rest comfortably on delivery (COD).</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-emerald-100/50">
                                    <div className="bg-white p-1 rounded-full">
                                        <Package className="w-3 h-3 text-emerald-600" />
                                    </div>
                                    <span className="text-xs font-medium text-emerald-800">
                                        Minimum Order Reduced to <span className="font-bold">₹3,999</span> per seller!
                                    </span>
                                </div>
                            </div>

                            {product.description && (
                                <div className="mb-5 border-t border-gray-100 pt-5">
                                    <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                                    <p className={`text-gray-600 text-sm md:text-base leading-relaxed whitespace-pre-wrap ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`}>
                                        {product.description}
                                    </p>
                                    <button
                                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                        className="text-emerald-600 font-medium text-sm mt-2 hover:text-emerald-700 hover:underline focus:outline-none"
                                    >
                                        {isDescriptionExpanded ? 'Read Less' : 'Read More'}
                                    </button>
                                </div>
                            )}



                            {/* Desktop Action Buttons */}
                            <div className="hidden md:flex gap-3 mt-3">
                                <button
                                    onClick={handleAddToCart}
                                    className="flex-1 py-3.5 px-6 border-2 border-emerald-600 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                                >
                                    <ShoppingCart className="w-5 h-5" />
                                    Add to Cart
                                </button>
                            </div>

                            {/* Trust & Return Policy */}
                            <TrustPolicy />
                        </div>

                        {/* Manufacturer Info Card */}
                        {product.manufacturer && (
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-emerald-200 transition-all mx-3 md:mx-0">
                                <Link
                                    href={`/seller/${product.manufacturer_id || product.manufacturer.id}`}
                                    className="block group/seller mb-4"
                                >
                                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <Building className="w-5 h-5 text-gray-400 group-hover/seller:text-emerald-600 transition-colors" />
                                        Seller Information
                                    </h3>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-gray-900 group-hover/seller:text-emerald-700 transition-colors">
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
                                        <div className="text-emerald-600 opacity-0 group-hover/seller:opacity-100 transition-opacity text-sm font-medium">
                                            View Profile
                                        </div>
                                    </div>
                                </Link>

                                <div className="pt-4 border-t border-gray-100">
                                    <DownloadCatalogButton
                                        categoryId={product.category_id}
                                        categoryName={product.category?.name || 'Category'}
                                        source="product"
                                        variant="ghost"
                                        className="w-full justify-start text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 h-auto py-2 -ml-2"
                                    />
                                </div>
                            </div>
                        )}

                        {/* More Products */}
                        {manufacturerProducts.length > 0 && product.manufacturer && (
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mx-3 md:mx-0">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-900">
                                        More from {product.manufacturer.business_name}
                                    </h3>
                                    <Link
                                        href={`/products?manufacturer=${product.manufacturer.id}`}
                                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                    >
                                        View All →
                                    </Link>
                                </div>
                                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
                                    {manufacturerProducts.map((item) => (
                                        <Link
                                            key={item.id}
                                            href={`/products/${item.id}`}
                                            className="flex-shrink-0 w-32 group"
                                        >
                                            <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2 border border-gray-100 group-hover:border-emerald-300 transition-colors">
                                                {item.images?.[0] ? (
                                                    <div className="relative w-full h-full">
                                                        <Image
                                                            src={item.images[0]}
                                                            alt={item.name}
                                                            fill
                                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="w-8 h-8 text-gray-300" />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-emerald-600 transition-colors">
                                                {item.name}
                                            </p>
                                            <p className="text-sm font-bold text-emerald-600">
                                                {formatCurrency(item.display_price)}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Sticky Bottom Action Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 z-40 safe-area-inset-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-2">
                    {/* Action Buttons - Full Width Add to Cart */}
                    <button
                        onClick={handleAddToCart}
                        disabled={addingToCart}
                        className="flex-1 h-11 bg-emerald-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20"
                    >
                        <ShoppingCart className="w-4 h-4" />
                        Add to Cart
                    </button>
                </div>
            </div>

            {/* Fullscreen Lightbox Modal */}
            {
                lightboxOpen && currentProduct.images && (
                    <div
                        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                        onClick={() => setLightboxOpen(false)}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setLightboxOpen(false)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-50"
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <Image
                                src={currentProduct.images[activeImageIndex]}
                                alt={currentProduct.name}
                                fill
                                className="object-contain"
                            />

                            {/* Navigation Arrows */}
                            {currentProduct.images.length > 1 && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setActiveImageIndex((prev) =>
                                                prev === 0 ? currentProduct.images!.length - 1 : prev - 1
                                            )
                                        }}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors"
                                    >
                                        <ChevronLeft className="w-8 h-8" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setActiveImageIndex((prev) =>
                                                prev === currentProduct.images!.length - 1 ? 0 : prev + 1
                                            )
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors"
                                    >
                                        <ChevronRight className="w-8 h-8" />
                                    </button>
                                </>
                            )}
                        </div>
                        {/* Thumbnail Strip */}
                        {currentProduct.images.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-xl overflow-x-auto max-w-[90vw]">
                                {currentProduct.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setActiveImageIndex(idx)
                                        }}
                                        className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${activeImageIndex === idx ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    >
                                        <div className="relative w-full h-full">
                                            <Image src={img} alt="" fill className="object-cover" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    )
}

