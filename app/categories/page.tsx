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

                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categories.map((category) => (
                        <Link
                            key={category.id}
                            href={`/products?category=${category.slug}`}
                            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all group"
                        >
                            <div className="text-5xl mb-4">
                                {categoryIcons[category.slug] || '📦'}
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                                {category.name}
                            </h2>
                            <div className="mt-2 text-sm text-gray-500">
                                Platform margin: <span className="font-medium text-emerald-600">+{category.markup_percentage}%</span>
                            </div>
                        </Link>
                    ))}
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
