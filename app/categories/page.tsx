'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Category } from '@/types'
import { Package, ChevronRight } from 'lucide-react'
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

    // Helper to build 3-level tree
    const getCategoryTree = (rootId: string | null) => {
        if (!rootId) return []

        // Level 2 (Subcategories of Root)
        const level2 = categories.filter(c => c.parent_id === rootId)

        return level2.map(sub => ({
            ...sub,
            // Level 3 (Subcategories of Level 2)
            children: categories.filter(c => c.parent_id === sub.id)
        }))
    }

    const parentCategories = categories.filter(c => !c.parent_id)
    const selectedCategory = categories.find(c => c.id === selectedCategoryId)
    const categoryTree = getCategoryTree(selectedCategoryId) // Replaced subCategories with categoryTree

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
                                    {getCategoryImage(parent.name) ? (
                                        <img src={getCategoryImage(parent.name)!} alt={parent.name} className="w-full h-full object-cover" />
                                    ) : parent.image_url ? (
                                        <img src={parent.image_url} alt={parent.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm md:text-lg font-bold text-gray-400">{parent.name[0]}</span>
                                    )}
                                </div>
                                <span className="text-[10px] md:text-sm font-semibold text-center md:text-left leading-tight md:line-clamp-2">
                                    {parent.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Right Content: 3-Level Hierarchy */}
                <main className="flex-1 overflow-y-auto bg-white p-4 md:p-6 lg:p-8">
                    {selectedCategory && (
                        <div className="max-w-5xl mx-auto h-full flex flex-col">
                            {/* Header: Level 1 (Root) */}
                            <div className="flex items-start justify-between mb-8 border-b border-gray-100 pb-4">
                                <div>
                                    <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                                        {getCategoryImage(selectedCategory.name) && (
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-50 flex items-center justify-center overflow-hidden border border-emerald-100">
                                                <img src={getCategoryImage(selectedCategory.name)!} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        {selectedCategory.name}
                                    </h1>

                                </div>
                                <Link
                                    href={`/products?category=${selectedCategory.slug}`}
                                    className="hidden md:inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Browse All Items
                                </Link>
                            </div>

                            {/* Level 2 & 3 Sections */}
                            <div className="space-y-10 pb-12">
                                {categoryTree.length > 0 ? (
                                    categoryTree.map(subCategory => (
                                        <div key={subCategory.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            {/* Level 2 Header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <Link href={`/products?category=${subCategory.slug}`} className="group flex items-center gap-2 hover:opacity-80">
                                                    <h2 className="text-lg md:text-xl font-bold text-gray-800 group-hover:text-emerald-700 transition-colors">
                                                        {subCategory.name}
                                                    </h2>
                                                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                                                </Link>

                                            </div>

                                            {/* Level 3 Grid (Leaf Nodes) */}
                                            {subCategory.children.length > 0 ? (
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                                    {subCategory.children.map(leaf => (
                                                        <Link
                                                            key={leaf.id}
                                                            href={`/products?category=${leaf.slug}`}
                                                            className="group flex flex-col items-center text-center p-3 rounded-xl bg-gray-50/50 hover:bg-white border border-transparent hover:border-emerald-200 hover:shadow-sm transition-all duration-200"
                                                        >
                                                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center mb-2 shadow-sm border border-gray-100 overflow-hidden group-hover:scale-105 transition-transform">
                                                                {leaf.image_url ? (
                                                                    <img src={leaf.image_url} alt={leaf.name} className="w-full h-full object-cover" />
                                                                ) : getCategoryImage(leaf.name) ? (
                                                                    <img src={getCategoryImage(leaf.name)!} alt={leaf.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-sm font-bold text-gray-400">{leaf.name[0]}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs md:text-sm font-medium text-gray-700 group-hover:text-emerald-700 line-clamp-2 leading-tight">
                                                                {leaf.name}
                                                            </span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : (
                                                // If no Level 3 (Leaf nodes), show placeholder or handle as leaf itself
                                                <div className="text-sm text-gray-400 italic pl-1">
                                                    No sub-categories. <Link href={`/products?category=${subCategory.slug}`} className="text-emerald-600 hover:underline not-italic ml-1">View products</Link>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    // If Root has no Level 2 children
                                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
                                        <Package className="w-12 h-12 text-gray-300 mb-3" />
                                        <p className="text-gray-500">No sub-categories found.</p>
                                        <Link
                                            href={`/products?category=${selectedCategory.slug}`}
                                            className="mt-4 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors"
                                        >
                                            View all products in {selectedCategory.name}
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
