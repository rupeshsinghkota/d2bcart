'use client'

import { Category } from '@/types'
import { getChildren, getSiblings } from '@/utils/category-helpers'

interface SubCategoryPillsProps {
    categories: Category[]
    selectedCategory: string
    onSelectCategory: (slug: string) => void
}

export const SubCategoryPills = ({ categories, selectedCategory, onSelectCategory }: SubCategoryPillsProps) => {
    // Determine which categories to show
    let categoriesToShow: Category[] = []
    let currentCategory: Category | undefined

    if (!selectedCategory) {
        // Root: Show Level 1 Categories
        categoriesToShow = getChildren(null, categories)
    } else {
        currentCategory = categories.find(c => c.slug === selectedCategory)
        if (currentCategory) {
            const children = getChildren(currentCategory.id, categories)
            if (children.length > 0) {
                // Has Children: Show Children (Drill Down)
                categoriesToShow = children
            } else {
                // Leaf Node: Show Siblings (Lateral Move)
                categoriesToShow = getSiblings(currentCategory.id, categories)
            }
        }
    }

    if (categoriesToShow.length === 0) return null

    return (
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 px-4 -mx-4 no-scrollbar">
            {!selectedCategory && (
                <button
                    onClick={() => onSelectCategory('')}
                    className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-emerald-600 text-white shadow-sm"
                >
                    All
                </button>
            )}

            {categoriesToShow.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => onSelectCategory(cat.slug)}
                    className={`
                        px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border
                        ${selectedCategory === cat.slug
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-200 hover:bg-emerald-50'
                        }
                    `}
                >
                    {cat.name}
                </button>
            ))}
        </div>
    )
}
