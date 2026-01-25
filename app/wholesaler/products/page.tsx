'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { revalidateData } from '@/app/actions/revalidate'
import { refineProduct } from '@/app/actions/refineProduct'
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Package,
    ArrowLeft,
    Upload,
    Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function ManufacturerProductsPage() {
    const router = useRouter()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filter, setFilter] = useState('all') // 'all', 'active', 'inactive', 'low_stock'
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isDeleting, setIsDeleting] = useState(false)

    const [debouncedSearch] = useState(searchQuery) // Initialize

    // Custom debounce hook usage or effect
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(searchQuery)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Initial fetch
    useEffect(() => {
        // Initial fetch handled by search effect above when searchQuery is empty
        // But need to prevent double fetch if query is empty initially?
        // Let's just rely on the debounce effect for all fetches including initial
    }, [])

    const fetchProducts = async (queryText = '') => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        let query = supabase
            .from('products')
            .select('*, category:categories(name)')
            .eq('manufacturer_id', user.id)
            .is('parent_id', null)
            .order('created_at', { ascending: false })

        if (queryText && queryText.trim().length > 0) {
            // Apply Top 1% Search Logic here (Client-Side for Manufacturer specific or Server-Side?)
            // Since we can't easily use the public 'getShopData' RPC which filters by is_active=true usually,
            // we will build a custom match here.

            // 1. Try search_vector if available (Best)
            // But we need to format the query.
            const cleanQuery = queryText.replace(/[!&|():*]/g, ' ').trim().split(/\s+/).join(' & ')
            if (cleanQuery) {
                // Use ilike for simplicity and robustness in dashboard without full FTS setup on all columns
                // Search Name, Description, and Smart Tags
                // This "or" syntax is: name contains X OR description contains X OR ...
                query = query.or(`name.ilike.%${queryText}%,description.ilike.%${queryText}%,smart_tags.cs.{${queryText}}`)
            }
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching products:', error)
            toast.error('Failed to load products')
        }

        if (data) {
            // Optional: Client-side sorting/filtering if needed
            setProducts(data as Product[])
        }
        setLoading(false)
    }

    // Removed detailed client-side filter since we do server-side search now
    const filteredProducts = products.filter(product => {
        // Only apply status filters client side
        if (filter === 'active') return product.is_active
        if (filter === 'inactive') return !product.is_active
        if (filter === 'low_stock') return product.stock < 10
        return true
    })
    // Handlers Restored
    const handleRefine = async (id: string) => {
        toast.promise(
            (async () => {
                const res = await refineProduct(id)
                if (!res.success) throw new Error(res.error)
                if (res.warning) return `Refined (Fallback): ${res.warning}`
                const varMsg = res.variationUpdateCount
                    ? ` | ${res.variationUpdateCount} variations updated`
                    : (res.debug ? ` | Debug: ${res.debug}` : '')
                return `Refined! Added ${res.tags?.length || 0} tags${varMsg}`
            })(),
            {
                loading: 'AI Refining Product...',
                success: (msg: any) => msg,
                error: (err) => `Error: ${err.message}`
            }
        )
    }

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const handleSelectAll = () => {
        if (selectedIds.size === filteredProducts.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)))
        }
    }

    const handleToggleActive = async (product: Product) => {
        const newStatus = !product.is_active
        setProducts(prev => prev.map(p =>
            p.id === product.id ? { ...p, is_active: newStatus } : p
        ))

        const { error } = await supabase
            .from('products')
            // @ts-ignore
            .update({ is_active: newStatus })
            .eq('id', product.id)

        if (error) {
            toast.error('Failed to update status')
            setProducts(prev => prev.map(p =>
                p.id === product.id ? { ...p, is_active: !newStatus } : p
            ))
        } else {
            toast.success(`Product ${newStatus ? 'activated' : 'deactivated'}`)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} products?`)) return

        setIsDeleting(true)
        const ids = Array.from(selectedIds)

        await supabase.from('products').delete().in('parent_id', ids)

        const { data, error } = await supabase
            .from('products')
            .delete()
            .in('id', ids)
            .select('id')

        if (error) {
            if (error.code === '23503') {
                const { error: updateError } = await supabase
                    .from('products')
                    // @ts-ignore
                    .update({ is_active: false })
                    .in('id', ids)

                if (updateError) {
                    toast.error('Failed to delete or deactivate.')
                } else {
                    toast.success(`Products deactivated (orders exist).`)
                    setProducts(prev => prev.map(p =>
                        ids.includes(p.id) ? { ...p, is_active: false } : p
                    ))
                    setSelectedIds(new Set())
                    await revalidateData('/')
                }
            } else {
                toast.error('Failed to delete products.')
                setSelectedIds(new Set())
                await revalidateData('/')
            }
        } else {
            const deletedCount = (data as any[])?.length || 0
            toast.success('Products deleted successfully')
            await revalidateData('/')

            if (deletedCount > 0) {
                const deletedIds = new Set((data as any[])?.map(d => d.id))
                setProducts(prev => prev.filter(p => !deletedIds.has(p.id)))
                setSelectedIds(new Set())
            }
        }
        setIsDeleting(false)
    }


    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Bulk Action Bar - Sticky Top when Items Selected */}
            <div className={`fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-md transform transition-transform duration-300 ${selectedIds.size > 0 ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <span className="font-semibold text-gray-900">{selectedIds.size} Selected</span>
                    </div>
                    <button
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isDeleting ? 'Deleting...' : (
                            <>
                                <Trash2 className="w-5 h-5" />
                                <span>Delete Selected</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/wholesaler"
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
                                href="/wholesaler/products/bulk"
                                className="btn-secondary flex items-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                            >
                                <Upload className="w-5 h-5" />
                                Bulk Upload
                            </Link>
                            <Link
                                href="/wholesaler/products/new"
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Product
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters & Search - Hide when selecting? Optional, keeping it visible */}
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

                    <div className="flex items-center gap-4">
                        {/* Select All Checkbox */}
                        {filteredProducts.length > 0 && (
                            <button
                                onClick={handleSelectAll}
                                className="text-sm font-medium text-emerald-600 hover:underline px-2"
                            >
                                {selectedIds.size === filteredProducts.length ? 'Deselect All' : 'Select All'}
                            </button>
                        )}

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
                                href="/wholesaler/products/new"
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Product
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map(product => {
                            const isSelected = selectedIds.has(product.id)
                            return (
                                <div
                                    key={product.id}
                                    className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all group relative border-2 ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-transparent'}`}
                                >
                                    {/* Selection Checkbox - Always visible on mobile, visible on hover/selected on desktop */}
                                    <div className={`absolute top-2 left-2 z-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${isSelected ? '!opacity-100' : ''}`}>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleToggleSelect(product.id)
                                            }}
                                            className={`w-6 h-6 rounded border bg-white flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}
                                        >
                                            {isSelected && <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                        </button>
                                    </div>

                                    <div className="aspect-[4/3] bg-gray-100 relative">
                                        {/* Click on image toggles selection if in selection mode, otherwise normal navigation? 
                                            Currently linking via Edit button overlay, so clicking image does nothing special unless we link it.
                                            Let's make clicking image go to edit or detail. 
                                        */}
                                        {product.images?.[0] ? (
                                            <Image
                                                src={product.images[0]}
                                                alt={product.name}
                                                fill
                                                className={`object-cover ${isSelected ? 'opacity-90' : ''}`}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-12 h-12 text-gray-300" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleToggleActive(product)
                                                }}
                                                className={`p-1.5 rounded-full transition-colors hidden group-hover:block ${product.is_active
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                                                    }`}
                                                title={product.is_active ? "Deactivate" : "Activate"}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${product.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                            </button>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.is_active
                                                ? 'bg-white/90 text-green-700'
                                                : 'bg-gray-900/90 text-white'
                                                }`}>
                                                {product.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        {product.stock < 10 && (
                                            <div className="absolute top-8 right-2">
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                    Low Stock: {product.stock}
                                                </span>
                                            </div>
                                        )}

                                        {/* Quick Actions Overlay - Hide when selected to avoid confusion? Or just keep it. */}
                                        {!isSelected && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-col gap-2">
                                                <button
                                                    onClick={() => handleRefine(product.id)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transform hover:scale-105 transition-transform flex items-center gap-2"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                    AI Refine
                                                </button>

                                                <div className="flex gap-2">
                                                    <Link
                                                        href={`/wholesaler/products/${product.id}/edit`}
                                                        className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium transform hover:scale-105 transition-transform"
                                                    >
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            handleToggleActive(product)
                                                        }}
                                                        className={`px-4 py-2 rounded-lg font-medium transform hover:scale-105 transition-transform text-white ${product.is_active
                                                                ? 'bg-red-500 hover:bg-red-600'
                                                                : 'bg-emerald-500 hover:bg-emerald-600'
                                                            }`}
                                                    >
                                                        {product.is_active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        className="p-4 cursor-pointer"
                                        onClick={(e) => {
                                            // Allow clicking card body to toggle select if already in selection mode
                                            if (selectedIds.size > 0) handleToggleSelect(product.id)
                                        }}
                                    >
                                        <div className="mb-2">
                                            <h3 className="font-semibold text-gray-900 line-clamp-1" title={product.name}>
                                                {product.name}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {product.category?.name || 'Uncategorized'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 mb-2">
                                            {product.smart_tags ? (
                                                <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                                    AI Refined
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase">Price</p>
                                                <p className="font-semibold text-emerald-600">
                                                    {formatCurrency(product.base_price)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase">Retailer Price</p>
                                                <p className="font-semibold text-blue-600">
                                                    {formatCurrency(product.display_price)}
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
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
