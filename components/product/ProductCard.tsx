'use client'

import Link from 'next/link'
import { Package, MapPin, Heart, Play } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'


import Image from 'next/image'
import { Product } from '@/types' // Assuming types exist, or use any

interface ProductCardProps {
    product: any // Using any to match existing flexibility, or ideally Product type
    wishlist?: string[]
    onToggleWishlist?: (e: React.MouseEvent, productId: string) => void
    priority?: boolean
}

export function ProductCard({ product, wishlist = [], onToggleWishlist, priority = false }: ProductCardProps) {
    const hasVariations = product.type === 'variable' && product.variations?.length > 0;
    const minPrice = hasVariations
        ? Math.min(...product.variations.map((v: any) => v.display_price))
        : (product.display_price || product.base_price);

    const minMoq = hasVariations
        ? Math.min(...product.variations.map((v: any) => v.moq || product.moq))
        : product.moq || 1;

    const variationCount = product.variations?.length || 0;

    return (
        <div className="relative group bg-white rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full hover:-translate-y-1 ring-1 ring-gray-100 hover:ring-0">
            <Link href={`/products/${product.slug || product.id}`} className="block relative">
                <div className="aspect-[4/5] bg-gray-50 relative overflow-hidden">
                    {product.images?.[0] ? (
                        <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                            priority={priority}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <Package className="w-10 h-10 text-gray-200" />
                        </div>
                    )}

                    {/* Floating Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start">
                        {/* MOQ Badge - Clean & Professional */}
                        <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold text-gray-800 shadow-sm border border-gray-100/50 flex items-center gap-1">
                            <span className="text-gray-400 font-medium">MOQ</span>
                            <span>{minMoq}</span>
                        </div>
                    </div>

                    {product.video_url && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:bg-black/10 transition-colors">
                            <div className="bg-black/40 backdrop-blur-md p-3 rounded-full border border-white/30 transform group-hover:scale-110 transition-all duration-300 shadow-lg">
                                <Play className="w-8 h-8 text-white fill-current" />
                            </div>
                        </div>
                    )}

                    {/* Category Tag - Bottom Left */}
                    {product.category && (
                        <div className="absolute bottom-2 left-2">
                            <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-medium text-white tracking-wide">
                                {product.category.name}
                            </span>
                        </div>
                    )}
                </div>
            </Link>

            <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1.5">
                {/* Manufacturer - Subtle */}
                {product.manufacturer && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                        <BuildingIcon className="w-3 h-3" />
                        <Link
                            href={`/seller/${product.manufacturer_id || product.manufacturer.id || ''}`}
                            className="truncate hover:text-emerald-600 transition-colors"
                        >
                            {product.manufacturer.business_name}
                        </Link>
                    </div>
                )}

                {/* Product Name */}
                <Link href={`/products/${product.slug || product.id}`} className="block flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-[15px] leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors min-h-[2.5em]">
                        {product.name}
                    </h4>
                </Link>

                {/* Bottom Section: Price & Variant Info */}
                <div className="mt-2 pt-2 border-t border-gray-50 flex items-end justify-between gap-2">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                            {hasVariations ? 'Starting from' : 'Wholesale Price'}
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-emerald-700 font-bold text-base sm:text-lg">
                                {formatCurrency(minPrice)}
                            </span>
                            {!hasVariations && <span className="text-xs text-gray-400 font-medium">/pc</span>}
                        </div>
                    </div>

                    {hasVariations && variationCount > 0 && (
                        <div className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/50">
                            {variationCount} Options
                        </div>
                    )}
                </div>
            </div>

            {/* Wishlist Button - Floating */}
            {onToggleWishlist && (
                <button
                    onClick={(e) => onToggleWishlist(e, product.id)}
                    className={`absolute top-2 right-2 p-2 rounded-full shadow-sm transition-all duration-300 z-10 ${wishlist.includes(product.id)
                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                        : 'bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white hover:scale-110 backdrop-blur-sm'
                        }`}
                >
                    <Heart className={`w-4 h-4 ${wishlist.includes(product.id) ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
    )
}

function BuildingIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" />
        </svg>
    )
}
