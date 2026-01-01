'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Search, Filter, Package, MapPin, Heart, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { CategorySidebar } from '@/components/product/CategorySidebar'
import { SubCategoryPills } from '@/components/product/SubCategoryPills'

import { MobileFilterBar } from '@/components/product/MobileFilterBar'
import { MobileCategorySheet } from '@/components/product/MobileCategorySheet'

const ProductsContent = () => {
    const searchParams = useSearchParams()
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
    const [selectedCategory, setSelectedCategory] = useState<string>(
        searchParams.get('category') || ''
    )
    const [wishlist, setWishlist] = useState<string[]>([])

    // New State for Mobile & Sorting
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [sortBy, setSortBy] = useState('newest')

    useEffect(() => {
        const query = searchParams.get('search')
        if (query !== null) {
            setSearchQuery(query)
        }

        const category = searchParams.get('category')
        if (category !== null) {
            setSelectedCategory(category)
        }
    }, [searchParams])

    useEffect(() => {
        fetchCategories()
        fetchProducts()
        fetchWishlist()
    }, [selectedCategory, sortBy]) // Re-fetch when sort changes
    // Note: We might want to trigger on searchQuery too if we were doing server-side filtering, but currently it's client-side filtering of the fetched list? 
    // Actually, looking at fetchProducts, it fetches based on Category. 
    // The search filtering happens in `filteredProducts` (line 136).
    // So changing searchQuery re-renders and re-filters automatically. Good.

    const fetchWishlist = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('wishlists')
            .select('product_id')
            .eq('user_id', user.id)

        if (data) setWishlist((data as any[]).map(w => w.product_id))
    }

    const toggleWishlist = async (e: React.MouseEvent, productId: string) => {
        e.preventDefault()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            toast.error('Please login to wishlist items')
            return
        }

        if (wishlist.includes(productId)) {
            // Remove
            const { error } = await supabase
                .from('wishlists')
                .delete()
                .match({ user_id: user.id, product_id: productId })

            if (!error) {
                setWishlist(prev => prev.filter(id => id !== productId))
                toast.success('Removed from wishlist')
            }
        } else {
            // Add
            const { error } = await (supabase.from('wishlists') as any)
                .insert({ user_id: user.id, product_id: productId })

            if (!error) {
                setWishlist(prev => [...prev, productId])
                toast.success('Added to wishlist')
            }
        }
    }

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name')

        if (data) setCategories(data)
    }

    const fetchProducts = async () => {
        setLoading(true)
        let query = supabase
            .from('products')
            .select(`
                *,
                manufacturer:users!products_manufacturer_id_fkey!inner(business_name, city, is_verified),
                category:categories!products_category_id_fkey(name, slug)
            `)
            .eq('is_active', true)
            .eq('manufacturer.is_verified', true)

        // Sorting
        switch (sortBy) {
            case 'price_asc':
                query = query.order('display_price', { ascending: true })
                break
            case 'price_desc':
                query = query.order('display_price', { ascending: false })
                break
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false })
                break
        }

        if (selectedCategory) {
            // 1. Get the selected category
            const { data: cat } = await supabase
                .from('categories')
                .select('id, parent_id')
                .eq('slug', selectedCategory)
                .single()

            if (cat) {
                // 2. Get all subcategories (children) of this category
                const { data }: any = await supabase.from('categories').select('id, parent_id')
                const allCats = data as { id: string, parent_id: string | null }[] | null
                const categoryId = (cat as any).id

                if (allCats) {
                    // Find all IDs that are descendants of categoryId
                    const getDescendants = (parentId: string): string[] => {
                        const children = allCats.filter(c => c.parent_id === parentId)
                        let ids = children.map(c => c.id)
                        children.forEach(child => {
                            ids = [...ids, ...getDescendants(child.id)]
                        })
                        return ids
                    }
                    const targetIds = [categoryId, ...getDescendants(categoryId)]
                    query = query.in('category_id', targetIds)
                } else {
                    // Fallback to just the category itself
                    query = query.eq('category_id', categoryId)
                }
            }
        }

        const { data, error } = await query

        if (data) {
            setProducts(data as Product[])
        }
        setLoading(false)
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getPageTitle = () => {
        if (searchQuery) return `Results for "${searchQuery}"`
        if (selectedCategory) {
            const cat = categories.find(c => c.slug === selectedCategory)
            return cat ? cat.name : 'Products'
        }
        return 'All Products'
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header (Desktop Only) */}
            <div className="bg-white border-b sticky top-16 z-20 shadow-sm hidden md:block">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
                    </div>
                </div>
            </div>

            {/* Mobile Actions Bar */}
            <MobileFilterBar
                currentSort={sortBy}
                onSortChange={setSortBy}
                onOpenFilter={() => setIsFilterOpen(true)}
            />

            {/* Mobile Category Sheet */}
            <MobileCategorySheet
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            <div className="max-w-7xl mx-auto px-4 py-3 md:py-6">
                <Breadcrumbs
                    selectedCategory={selectedCategory}
                    categories={categories}
                    onCategorySelect={setSelectedCategory}
                />

                <div className="flex gap-8 items-start">
                    {/* Desktop Sidebar - Now passing className explicit */}
                    <CategorySidebar
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                        className="hidden lg:block sticky top-24"
                    />

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                        {/* Mobile Pills */}
                        <SubCategoryPills
                            categories={categories}
                            selectedCategory={selectedCategory}
                            onSelectCategory={setSelectedCategory}
                        />

                        {/* Products Grid */}
                        {loading ? (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                    <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse border border-gray-100">
                                        <div className="h-40 md:h-48 bg-gray-100" />
                                        <div className="p-4 space-y-3">
                                            <div className="h-4 bg-gray-100 rounded w-3/4" />
                                            <div className="h-6 bg-gray-100 rounded w-1/2" />
                                            <div className="h-3 bg-gray-100 rounded w-full" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                                    No products found
                                </h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    We couldn't find any products in this category matching your search. Try checking other categories.
                                </p>
                                <button
                                    onClick={() => {
                                        setSelectedCategory('')
                                        setSearchQuery('')
                                    }}
                                    className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    View All Products
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <p className="text-sm text-gray-500">
                                        Showing <span className="font-semibold text-gray-900">{filteredProducts.length}</span> results
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                                    {filteredProducts.map(product => (
                                        <div key={product.id} className="relative group flex flex-col bg-white rounded-xl border border-gray-100 hover:shadow-lg hover:border-emerald-100 transition-all duration-300 overflow-hidden">
                                            <Link
                                                href={`/products/${product.id}`}
                                                className="flex-1 flex flex-col"
                                            >
                                                {/* Image */}
                                                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                                    {product.images?.[0] ? (
                                                        <img
                                                            src={product.images[0]}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package className="w-10 h-10 text-gray-300" />
                                                        </div>
                                                    )}
                                                    {product.category && (
                                                        <span className="absolute top-2 left-2 bg-white/95 px-2 py-0.5 rounded text-[10px] font-semibold text-gray-700 shadow-sm backdrop-blur-sm">
                                                            {product.category.name}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="p-3 md:p-4 flex flex-col flex-1">
                                                    <h3 className="text-sm md:text-base font-medium text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-2 mb-1">
                                                        {product.name}
                                                    </h3>

                                                    {product.manufacturer && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                                            <MapPin className="w-3 h-3" />
                                                            <span className="truncate">{product.manufacturer.business_name}</span>
                                                        </div>
                                                    )}

                                                    <div className="mt-auto flex items-end justify-between gap-2">
                                                        <div>
                                                            <div className="text-lg md:text-xl font-bold text-gray-900">
                                                                {formatCurrency(product.display_price)}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                MOQ: {product.moq} pcs
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                // Add quick add logic here if needed, currently leads to details
                                                            }}
                                                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                                                        >
                                                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </Link>

                                            <button
                                                onClick={(e) => toggleWishlist(e, product.id)}
                                                className={`absolute top-2 right-2 p-1.5 md:p-2 rounded-full shadow-sm transition-all z-10 ${wishlist.includes(product.id)
                                                    ? 'bg-white text-red-500'
                                                    : 'bg-white/80 text-gray-400 hover:text-red-500 backdrop-blur-sm'
                                                    }`}
                                            >
                                                <Heart className={`w-4 h-4 md:w-5 md:h-5 ${wishlist.includes(product.id) ? 'fill-current' : ''}`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function ProductsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading products...</div>}>
            <ProductsContent />
        </Suspense>
    )
}
