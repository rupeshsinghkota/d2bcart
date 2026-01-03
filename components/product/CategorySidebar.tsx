'use client'

import { Category } from '@/types'
import { getChildren } from '@/utils/category-helpers'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getCategoryImage } from '@/utils/category'
import Image from 'next/image'

interface CategorySidebarProps {
    categories: Category[]
    selectedCategory: string
    onSelectCategory: (slug: string) => void
    className?: string
}

export const CategorySidebar = ({ categories, selectedCategory, onSelectCategory, className = '' }: CategorySidebarProps) => {
    const [expanded, setExpanded] = useState<string[]>([])

    // Auto-expand path when selection changes
    useEffect(() => {
        const current = categories.find(c => c.slug === selectedCategory)
        if (current && current.parent_id) {
            setExpanded(prev => Array.from(new Set([...prev, current.parent_id!])))
        }
    }, [selectedCategory, categories])

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setExpanded(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const renderTree = (parentId: string | null, level = 0) => {
        const children = getChildren(parentId, categories)
        if (children.length === 0) return null

        return (
            <div className={`flex flex-col ${level > 0 ? 'ml-3 border-l border-gray-100 pl-3' : 'gap-1'}`}>
                {children.map(cat => {
                    const isSelected = cat.slug === selectedCategory
                    const hasChildren = categories.some(c => c.parent_id === cat.id)
                    const isExpanded = expanded.includes(cat.id)

                    return (
                        <div key={cat.id}>
                            <div
                                className={`
                                    group flex items-center justify-between py-2 px-2 rounded-lg cursor-pointer transition-colors text-sm
                                    ${isSelected ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                                onClick={() => {
                                    if (hasChildren && !isExpanded) {
                                        setExpanded(prev => [...prev, cat.id])
                                    }
                                    onSelectCategory(cat.slug)
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    {level === 0 && (() => {
                                        const img = getCategoryImage(cat.name)
                                        return img ? (
                                            <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 relative">
                                                <Image src={img} fill className="object-cover" alt="" />
                                            </div>
                                        ) : null
                                    })()}
                                    <span>{cat.name}</span>
                                </div>
                                {hasChildren && (
                                    <button
                                        onClick={(e) => toggleExpand(cat.id, e)}
                                        className={`p-0.5 rounded-full hover:bg-gray-200 transition-all ${isExpanded ? 'rotate-180' : ''}`}
                                    >
                                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                )}
                            </div>
                            {isExpanded && renderTree(cat.id, level + 1)}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className={`w-full lg:w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 h-fit ${className}`}>
            <h3 className="font-bold text-gray-900 mb-4 px-2">Categories</h3>
            <button
                onClick={() => onSelectCategory('')}
                className={`w-full text-left py-2 px-2 rounded-lg text-sm mb-2 transition-colors ${!selectedCategory ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                All Products
            </button>
            {renderTree(null)}
        </div>
    )
}
