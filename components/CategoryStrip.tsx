'use client'

import Link from 'next/link'
import { useRef, useEffect, useState } from 'react'
import { getShopCategories } from '@/app/actions/getShopData'
import { Category } from '@/types'

export default function CategoryStrip() {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const fetched = await getShopCategories()
                // Filter for Leaf Categories (Lowest Level)
                // These are categories that have NO children.
                // Logic: A category is a leaf if its ID is NOT found in the set of all parent_ids.
                const allParentIds = new Set(fetched.map(c => c.parent_id).filter(Boolean))
                const leafCategories = fetched.filter(cat => !allParentIds.has(cat.id))

                // Sort leaves alphabetically or by some priority if needed. Defaulting to existing order.
                setCategories(leafCategories)
            } catch (error) {
                console.error('Failed to load categories', error)
            } finally {
                setLoading(false)
            }
        }
        fetchCategories()
    }, [])

    return (
        <div className="w-full bg-white border-b border-gray-100 md:hidden">
            <div
                ref={scrollRef}
                className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* Static 'All' Option */}
                <Link
                    href="/products"
                    className="flex-shrink-0 px-4 py-1.5 bg-gray-50 text-gray-700 text-xs font-medium rounded-full border border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors whitespace-nowrap active:scale-95"
                >
                    All
                </Link>

                {/* Dynamic Categories */}
                {!loading && categories.map((cat) => (
                    <Link
                        key={cat.id}
                        href={`/products?category=${cat.slug || cat.id}`}
                        className="flex-shrink-0 px-4 py-1.5 bg-gray-50 text-gray-700 text-xs font-medium rounded-full border border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors whitespace-nowrap active:scale-95"
                    >
                        {cat.name}
                    </Link>
                ))}

                {/* Loading Skeleton (Optional, keeps layout stable) */}
                {loading && (
                    <>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex-shrink-0 w-20 h-7 bg-gray-50 rounded-full animate-pulse border border-gray-100" />
                        ))}
                    </>
                )}
            </div>
        </div>
    )
}
