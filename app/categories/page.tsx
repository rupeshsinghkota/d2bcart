'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Category } from '@/types'
import { Package } from 'lucide-react'

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

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

        if (data) setCategories(data)
        setLoading(false)
    }

    const categoryIcons: Record<string, string> = {
        'electronics': '📱',
        'mobile-accessories': '🔌',
        'fashion': '👕',
        'fmcg': '🛒',
        'hardware': '🔧',
        'stationery': '📝',
        'home-kitchen': '🏠',
        'beauty': '💄',
        'sports': '⚽',
        'toys': '🎮'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        Product Categories
                    </h1>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        Browse products by category. Each category has different platform margins.
                    </p>
                </div>

                <div className="space-y-12">
                    {/* Top Level Categories */}
                    {categories.filter(c => !c.parent_id).map(parent => {
                        const children = categories.filter(c => c.parent_id === parent.id)

                        return (
                            <div key={parent.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center text-4xl">
                                            {parent.image_url ? (
                                                <img src={parent.image_url} alt={parent.name} className="w-full h-full object-cover rounded-xl" />
                                            ) : (
                                                categoryIcons[parent.slug] || '📦'
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900">{parent.name}</h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-sm text-gray-500">Margin:</span>
                                                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                                    +{parent.markup_percentage}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/products?category=${parent.slug}`}
                                        className="btn-secondary whitespace-nowrap"
                                    >
                                        View All {parent.name}
                                    </Link>
                                </div>

                                {/* Subcategories Grid */}
                                {children.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {children.map(child => (
                                            <Link
                                                key={child.id}
                                                href={`/products?category=${child.slug}`}
                                                className="group p-4 rounded-xl bg-gray-50 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
                                            >
                                                <div className="font-semibold text-gray-900 group-hover:text-emerald-700">
                                                    {child.name}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 max-w-full truncate">
                                                    Margin: <span className="font-medium text-emerald-600">+{child.markup_percentage}%</span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400 italic">No subcategories</div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {categories.length === 0 && (
                    <div className="text-center py-20">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">
                            No categories yet
                        </h3>
                        <p className="text-gray-500">
                            Categories will appear here once added
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
