'use client'

import { useState } from 'react'
import { Product } from '@/types'
import { ProductCard } from '@/components/product/ProductCard'
import { getSellerProductsAction } from '@/app/actions/seller'
import { Loader2, Package } from 'lucide-react'

interface SellerProductGridProps {
    initialProducts: Product[]
    sellerId: string
    initialTotal: number
}

export function SellerProductGrid({ initialProducts, sellerId, initialTotal }: SellerProductGridProps) {
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [total, setTotal] = useState(initialTotal)
    const limit = 12

    const hasMore = products.length < total

    const handleLoadMore = async () => {
        setLoading(true)
        const nextPage = page + 1
        const { products: newProducts } = await getSellerProductsAction(sellerId, nextPage, limit)

        if (newProducts.length > 0) {
            setProducts(prev => [...prev, ...newProducts])
            setPage(nextPage)
        }
        setLoading(false)
    }

    if (products.length === 0) {
        return (
            <div className="bg-white rounded-xl p-12 text-center border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No products listed</h3>
                <p className="text-gray-500 text-sm mt-1">This seller has not added any products yet.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>

            {hasMore && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={handleLoadMore}
                        disabled={loading}
                        className="btn-secondary min-w-[150px] flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            'Load More'
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}
