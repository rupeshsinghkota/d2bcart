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
        <div className="min-h-screen bg-gray-50 pb-safe">
            {/* Header (Desktop Only) */}
            <div className="sticky top-16 z-20 hidden md:block">
                <div className="absolute inset-0 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm" />
                <div className="relative max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{getPageTitle()}</h1>
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

            <div className="max-w-7xl mx-auto px-4 py-3 md:py-8">
                <Breadcrumbs
                    selectedCategory={selectedCategory}
                    categories={categories}
                    onCategorySelect={setSelectedCategory}
                />

                <div className="flex gap-8 items-start mt-4">
                    {/* Desktop Sidebar */}
                    <CategorySidebar
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                        className="hidden lg:block sticky top-32"
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
                                    <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100/50 shadow-sm">
                                        <div className="h-40 md:h-48 bg-gray-100 animate-pulse" />
                                        <div className="p-4 space-y-3">
                                            <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                                            <div className="h-6 bg-gray-100 rounded w-1/2 animate-pulse" />
                                            <div className="h-8 bg-gray-100 rounded w-full animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Package className="w-10 h-10 text-gray-300" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    No products found
                                </h3>
                                <p className="text-gray-500 max-w-sm mx-auto text-center mb-6">
                                    We couldn't find any products in this category matching your search.
                                </p>
                                <button
                                    onClick={() => {
                                        setSelectedCategory('')
                                        setSearchQuery('')
                                    }}
                                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10 hover:shadow-xl hover:-translate-y-0.5"
                                >
                                    Browse All Products
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <p className="text-sm text-gray-500 font-medium">
                                        Showing <span className="text-gray-900 font-bold">{filteredProducts.length}</span> products
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                    {filteredProducts.map(product => (
                                        <div key={product.id} className="relative group bg-white rounded-xl border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-emerald-100 flex flex-col h-full overflow-hidden">
                                            <Link href={`/products/${product.id}`} className="flex-1 flex flex-col">
                                                {/* Image */}
                                                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                                    {product.images?.[0] ? (
                                                        <img
                                                            src={product.images[0]}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package className="w-12 h-12 text-gray-300" />
                                                        </div>
                                                    )}

                                                    {/* Category Badge */}
                                                    {product.category && (
                                                        <span className="absolute top-2 left-2 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider text-gray-800 shadow-sm border border-gray-100/50">
                                                            {product.category.name}
                                                        </span>
                                                    )}

                                                    {/* Quick View / Add Overlay (Desktop) */}
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center">
                                                        <span className="bg-white text-gray-900 px-4 py-2 rounded-full font-medium text-sm shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                                            View Details
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="p-4 flex flex-col flex-1">
                                                    {product.manufacturer && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                                                            <MapPin className="w-3 h-3" />
                                                            <span className="truncate max-w-[150px]">{product.manufacturer.business_name}</span>
                                                        </div>
                                                    )}

                                                    <h3 className="font-semibold text-gray-900 text-sm md:text-base leading-snug mb-1 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                                                        {product.name}
                                                    </h3>

                                                    <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                                                        <div>
                                                            <div className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
                                                                {formatCurrency(product.display_price)}
                                                            </div>
                                                            <div className="text-xs font-medium text-gray-400 mt-0.5">
                                                                Min. {product.moq} pcs
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                // Add logic
                                                            }}
                                                            className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-600 hover:text-white hover:shadow-lg hover:shadow-emerald-600/20 transition-all duration-300"
                                                        >
                                                            <ChevronRight className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </Link>

                                            <button
                                                onClick={(e) => toggleWishlist(e, product.id)}
                                                className={`absolute top-2 right-2 p-2 rounded-full shadow-sm border border-gray-100 transition-all z-10 ${wishlist.includes(product.id)
                                                    ? 'bg-red-50 text-red-500 border-red-100'
                                                    : 'bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white backdrop-blur-sm'
                                                    }`}
                                            >
                                                <Heart className={`w-4 h-4 ${wishlist.includes(product.id) ? 'fill-current' : ''}`} />
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
