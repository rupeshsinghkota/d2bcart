'use client'

import Link from 'next/link'
import { Package, Plus, MapPin, Heart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { Product } from '@/types' // Assuming types exist, or use any

interface ProductCardProps {
    product: any // Using any to match existing flexibility, or ideally Product type
    wishlist?: string[]
    onToggleWishlist?: (e: React.MouseEvent, productId: string) => void
}

export function ProductCard({ product, wishlist = [], onToggleWishlist }: ProductCardProps) {
    return (
        <div className="relative group bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col h-full active:scale-[0.98]">
            <div className="flex-1 flex flex-col">
                <Link href={`/products/${product.id}`} className="block">
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                        {product.images?.[0] ? (
                            <Image
                                src={product.images[0]}
                                alt={product.name}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
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

                        {/* Category Badge */}
                        {product.category && (
                            <span className="absolute bottom-1.5 left-1.5 bg-white/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-medium text-gray-800 shadow-sm">
                                {product.category.name}
                            </span>
                        )}
                    </div>
                </Link>

                <div className="p-2 sm:p-3 flex flex-col flex-1">
                    {/* Manufacturer Link */}
                    {product.manufacturer && (
                        <div
                            className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 mb-1.5"
                        >
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <Link
                                href={`/seller/${product.manufacturer_id || product.manufacturer.id || ''}`} // Handle different data shapes if needed
                                className="truncate max-w-[150px] hover:text-emerald-600 hover:underline transition-colors"
                            >
                                {product.manufacturer.business_name}
                            </Link>
                        </div>
                    )}

                    <Link href={`/products/${product.id}`}>
                        <h4 className="font-medium text-gray-900 text-xs sm:text-sm line-clamp-2 mb-1.5 leading-snug min-h-[2.5em] group-hover:text-emerald-700 transition-colors">
                            {product.name}
                        </h4>
                    </Link>

                    <div className="mt-auto flex items-end justify-between gap-2">
                        <div>
                            <span className="text-emerald-700 font-bold text-sm sm:text-base">
                                {product.type === 'variable' && 'From '}{formatCurrency(product.display_price || product.base_price)}
                            </span>
                        </div>

                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                useStore.getState().addToCart(product, product.moq);
                                toast.success('Added to cart!');
                            }}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100/50"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {onToggleWishlist && (
                <button
                    onClick={(e) => onToggleWishlist(e, product.id)}
                    className={`absolute top-1.5 right-1.5 p-1.5 rounded-full shadow-sm border border-gray-100 transition-all z-10 ${wishlist.includes(product.id)
                        ? 'bg-red-50 text-red-500 border-red-100'
                        : 'bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white backdrop-blur-sm'
                        }`}
                >
                    <Heart className={`w-3.5 h-3.5 ${wishlist.includes(product.id) ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
    )
}
