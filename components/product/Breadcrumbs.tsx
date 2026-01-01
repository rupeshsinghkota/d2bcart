'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { Category } from '@/types'
import { getAncestors } from '@/utils/category-helpers'

interface BreadcrumbsProps {
    selectedCategory: string
    categories: Category[]
    onCategorySelect: (slug: string) => void
}

export const Breadcrumbs = ({ selectedCategory, categories, onCategorySelect }: BreadcrumbsProps) => {
    if (!selectedCategory) return null

    const currentCategory = categories.find(c => c.slug === selectedCategory)
    // Fallback: If slug not found in loaded categories (rare race condition), return null
    if (!currentCategory) return null

    const ancestors = getAncestors(currentCategory.id, categories)

    return (
        <nav className="flex items-center text-sm text-gray-500 mb-4 overflow-x-auto whitespace-nowrap pb-2 no-scrollbar">
            <Link href="/" className="flex items-center hover:text-emerald-600 transition-colors">
                <Home className="w-4 h-4 mr-1" />
                Home
            </Link>

            <ChevronRight className="w-4 h-4 mx-2 text-gray-400 flex-shrink-0" />

            <button
                onClick={() => onCategorySelect('')}
                className="hover:text-emerald-600 transition-colors"
            >
                Products
            </button>

            {ancestors.map((cat, index) => (
                <React.Fragment key={cat.id}>
                    <ChevronRight className="w-4 h-4 mx-2 text-gray-400 flex-shrink-0" />
                    <button
                        onClick={() => onCategorySelect(cat.slug)}
                        className={`${index === ancestors.length - 1
                                ? 'font-semibold text-gray-900 pointer-events-none'
                                : 'hover:text-emerald-600 transition-colors'
                            }`}
                    >
                        {cat.name}
                    </button>
                </React.Fragment>
            ))}
        </nav>
    )
}
