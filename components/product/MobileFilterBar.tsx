'use client'

import { ArrowUpDown, Filter } from 'lucide-react'
import { useState } from 'react'

interface MobileFilterBarProps {
    currentSort: string
    onSortChange: (sort: string) => void
    onOpenFilter: () => void
}

export const MobileFilterBar = ({ currentSort, onSortChange, onOpenFilter }: MobileFilterBarProps) => {
    const [isSortOpen, setIsSortOpen] = useState(false)

    const sortOptions = [
        { label: 'Recommended', value: 'recommended' },
        { label: 'Newest First', value: 'newest' },
        { label: 'Price: Low to High', value: 'price_asc' },
        { label: 'Price: High to Low', value: 'price_desc' },
    ]

    return (
        <div className="lg:hidden sticky top-16 z-10 bg-white border-b border-gray-100 px-4 py-2 mb-4 shadow-sm flex items-center justify-between gap-4">
            {/* Sort Dropdown */}
            <div className="relative flex-1">
                <button
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full justify-center py-1.5 active:bg-gray-50 rounded"
                >
                    <ArrowUpDown className="w-4 h-4 text-gray-500" />
                    <span>
                        {sortOptions.find(o => o.value === currentSort)?.label || 'Sort'}
                    </span>
                </button>

                {isSortOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsSortOpen(false)}
                        />
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-20 py-1 overflow-hidden">
                            {sortOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onSortChange(option.value)
                                        setIsSortOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${currentSort === option.value ? 'text-emerald-600 font-medium bg-emerald-50' : 'text-gray-700'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="w-[1px] h-6 bg-gray-200"></div>

            {/* Filter Button */}
            <div className="flex-1">
                <button
                    onClick={onOpenFilter}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full justify-center py-1.5 active:bg-gray-50 rounded"
                >
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span>Categories</span>
                </button>
            </div>
        </div>
    )
}
