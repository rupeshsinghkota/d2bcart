'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
    Plus,
    Search,
    Filter,
    Edit,
    Trash2,
    MoreVertical,
    Package,
    ArrowLeft,
    Upload,
    Download
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ManufacturerProductsPage() {
    const router = useRouter()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filter, setFilter] = useState('all') // 'all', 'active', 'inactive', 'low_stock'

    useEffect(() => {
        fetchProducts()
    }, [])

    const fetchProducts = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        const { data } = await supabase
            .from('products')
            .select('*, category:categories(name)')
            .eq('manufacturer_id', user.id)
            .order('created_at', { ascending: false })

        if (data) setProducts(data as Product[])
        setLoading(false)
    }

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())

        if (!matchesSearch) return false

        if (filter === 'active') return product.is_active
        if (filter === 'inactive') return !product.is_active
        if (filter === 'low_stock') return product.stock < 10

        return true
    })

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
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/manufacturer"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
                            <p className="text-gray-600">Manage your product catalog</p>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                href="/manufacturer/products/bulk"
                                className="btn-secondary flex items-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                            >
                                <Upload className="w-5 h-5" />
                                Bulk Upload
                            </Link>
                            <Link
                                href="/manufacturer/products/new"
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Product
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        {['all', 'active', 'inactive', 'low_stock'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {f.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Products List */}
                {filteredProducts.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                        <p className="text-gray-500 mb-6">
                            {searchQuery
                                ? "No products match your search criteria"
                                : "Get started by adding your first product"}
                        </p>
                        {!searchQuery && (
                            <Link
                                href="/manufacturer/products/new"
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Product
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                                <div className="aspect-[4/3] bg-gray-100 relative">
                                    {product.images?.[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-12 h-12 text-gray-300" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.is_active
                                                ? 'bg-white/90 text-green-700'
                                                : 'bg-gray-900/90 text-white'
                                            }`}>
                                            {product.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    {product.stock < 10 && (
                                        <div className="absolute top-2 left-2">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                Low Stock: {product.stock}
                                            </span>
                                        </div>
                                    )}

                                    {/* Quick Actions Overlay */}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Link
                                            href={`/manufacturer/products/${product.id}/edit`}
                                            className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium transform hover:scale-105 transition-transform"
                                        >
                                            Edit Product
                                        </Link>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <div className="mb-2">
                                        <h3 className="font-semibold text-gray-900 line-clamp-1" title={product.name}>
                                            {product.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {product.category?.name || 'Uncategorized'}
                                        </p>
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">Price</p>
                                            <p className="font-semibold text-emerald-600">
                                                {formatCurrency(product.base_price)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase">Stock</p>
                                            <p className="font-medium text-gray-900">
                                                {product.stock} units
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
