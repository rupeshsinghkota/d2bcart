'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Category } from '@/types'
import { Package } from 'lucide-react'
import { getCategoryImage } from '@/utils/category'

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

    useEffect(() => {
        fetchCategories()
    }, [])

    const fetchCategories = async () => {
        if (!isSupabaseConfigured) {
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name')

        if (data) {
            const typedData = data as Category[]
            setCategories(typedData)
            // Select the first parent category by default
            const firstParent = typedData.find(c => !c.parent_id)
            if (firstParent) setSelectedCategoryId(firstParent.id)
        }
        setLoading(false)
    }

    const parentCategories = categories.filter(c => !c.parent_id)
    const selectedCategory = categories.find(c => c.id === selectedCategoryId)
    const subCategories = categories.filter(c => c.parent_id === selectedCategoryId)

    if (loading) {
        return (
            <div className="h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (categories.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
                <Package className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No categories found</h3>
                <p className="text-gray-500">Please add categories from the admin panel.</p>
            </div>
        )
    }

    return (
        <div className="bg-white h-[calc(100vh-64px)] md:h-[calc(100vh-72px)] overflow-hidden flex flex-col">
            {/* Mobile Header (Optional, if not covered by global header) */}

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Parent Categories */}
                <aside className="w-[100px] sm:w-[140px] md:w-1/4 lg:w-1/5 bg-gray-50 border-r border-gray-200 overflow-y-auto no-scrollbar">
                    <div className="flex flex-col">
                        {parentCategories.map(parent => (
                            <button
                                key={parent.id}
                                onClick={() => setSelectedCategoryId(parent.id)}
                                className={`
                                    flex flex-col md:flex-row items-center md:gap-3 p-3 md:p-4 text-left transition-all border-b border-gray-100 last:border-0
                                    ${selectedCategoryId === parent.id
                                        ? 'bg-white text-emerald-700 border-l-4 border-l-emerald-600 shadow-sm z-10'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-l-transparent'}
                                `}
                            >
                                <div className={`
                                    w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mb-1 md:mb-0 shrink-0 overflow-hidden
                                    ${selectedCategoryId === parent.id ? 'bg-emerald-50' : 'bg-gray-200/50'}
                                `}>
                                    {parent.image_url ? (
                                        <img src={parent.image_url} alt={parent.name} className="w-full h-full object-cover" />
                                    ) : (
                                        getCategoryImage(parent.name) ? (
                                            <img src={getCategoryImage(parent.name)!} alt={parent.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-sm md:text-lg font-bold text-gray-400">{parent.name[0]}</span>
                                        )
                                    )}
                                </div>
                                <span className="text-[10px] md:text-sm font-semibold text-center md:text-left leading-tight md:line-clamp-2">
                                    {parent.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Right Content: Subcategories */}
                <main className="flex-1 overflow-y-auto bg-white p-4 md:p-6 lg:p-8">
                    {selectedCategory && (
                        <div className="max-w-4xl mx-auto h-full flex flex-col">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6 md:mb-8 border-b border-gray-100 pb-4">
                                <div>
                                    <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
                                        {selectedCategory.name}
                                    </h1>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs md:text-sm text-gray-500">Platform Margin:</span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            +{selectedCategory.markup_percentage}%
                                        </span>
                                    </div>
                                </div>
                                <Link
                                    href={`/products?category=${selectedCategory.slug}`}
                                    className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Browse All
                                </Link>
                            </div>

                            {/* Subcategories Grid */}
                            {subCategories.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                                    {subCategories.map(sub => (
                                        <Link
                                            key={sub.id}
                                            href={`/products?category=${sub.slug}`}
                                            className="group relative flex flex-col bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all p-3 md:p-4 text-center items-center h-full"
                                        >
                                            <div className="w-14 h-14 md:w-20 md:h-20 bg-gray-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                                {/* Reuse parent image or show generic icon for subcategory if no specific image */}
                                                <Package className="w-6 h-6 md:w-8 md:h-8 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 line-clamp-2">
                                                {sub.name}
                                            </h3>
                                            <div className="mt-auto pt-2">
                                                <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    +{sub.markup_percentage}% Margin
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 min-h-[200px]">
                                    <Package className="w-12 h-12 text-gray-300 mb-2" />
                                    <p className="text-gray-500 text-sm">No subcategories yet</p>
                                    <Link
                                        href={`/products?category=${selectedCategory.slug}`}
                                        className="mt-4 text-emerald-600 font-medium hover:underline text-sm"
                                    >
                                        Browse all {selectedCategory.name} products
                                    </Link>
                                </div>
                            )}

                            {/* Mobile "Browse All" Button (Fixed at bottom or inline) */}
                            <div className="mt-8 md:hidden">
                                <Link
                                    href={`/products?category=${selectedCategory.slug}`}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
                                >
                                    Browse All {selectedCategory.name} products
                                </Link>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
