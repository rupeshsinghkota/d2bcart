'use client'

import { useState, useEffect, Suspense, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Search, Filter, Package, MapPin, Heart, Plus, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useInView } from 'react-intersection-observer'

import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { CategorySidebar } from '@/components/product/CategorySidebar'
import { useStore } from '@/lib/store'
import { getCategoryImage } from '@/utils/category'
import Image from 'next/image'

import { MobileFilterBar } from '@/components/product/MobileFilterBar'
import { MobileCategorySheet } from '@/components/product/MobileCategorySheet'
import { ProductCard } from '@/components/product/ProductCard'
import DownloadCatalogButton from '@/components/catalog/DownloadCatalogButton'

interface ProductsClientProps {
    initialProducts: Product[]
    initialCategories: Category[]
    initialSelectedCategory: string
    initialTotal?: number
}

export default function ProductsClient({
    initialProducts,
    initialCategories,
    initialSelectedCategory,
    initialTotal = 0
}: ProductsClientProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { ref, inView } = useInView()

    // Initialize state with server-provided prop
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [categories, setCategories] = useState<Category[]>(initialCategories)

    // Pagination State
    const [page, setPage] = useState(1)
    const PRODUCTS_PER_PAGE = 20
    const [hasMore, setHasMore] = useState(initialProducts.length >= PRODUCTS_PER_PAGE)
    const [isFetchingMore, setIsFetchingMore] = useState(false)
    const [loading, setLoading] = useState(false) // For initial/filter loads

    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string>(initialSelectedCategory)
    const [wishlist, setWishlist] = useState<string[]>([])

    // New State for Mobile & Sorting
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [sortBy, setSortBy] = useState('newest')

    // Debounce search input
    useEffect(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current)
        }
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
        }, 300) // 300ms debounce

        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current)
            }
        }
    }, [searchQuery])

    useEffect(() => {
        const query = searchParams.get('search')
        if (query !== null) {
            setSearchQuery(query)
        }

        const category = searchParams.get('category')
        if (category !== null && category !== selectedCategory) {
            setSelectedCategory(category)
        }
    }, [searchParams])

    // Reset and Fetch when Filters Change (uses debounced search)
    useEffect(() => {
        const isInitialMount = products.length > 0 && selectedCategory === initialSelectedCategory && sortBy === 'newest' && page === 1 && !debouncedSearchQuery;

        if (!isInitialMount) {
            setPage(1)
            setHasMore(true)
            fetchProducts(1, true)
        }
    }, [selectedCategory, sortBy, debouncedSearchQuery])

    // Fetch Wishlist
    useEffect(() => {
        fetchWishlist()
    }, [])

    // Infinite Scroll Trigger
    useEffect(() => {
        if (inView && hasMore && !isFetchingMore && !loading) {
            loadMore()
        }
    }, [inView, hasMore, isFetchingMore, loading])

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

    const handleCategorySelect = (slug: string) => {
        setSelectedCategory(slug)
        // Update URL shallowly
        const params = new URLSearchParams(searchParams.toString())
        if (slug) {
            params.set('category', slug)
        } else {
            params.delete('category')
        }
        router.push(`/products?${params.toString()}`, { scroll: false })
    }

    const fetchProducts = async (pageNumber: number, isReset: boolean = false) => {
        const isLoadingMore = pageNumber > 1

        if (isLoadingMore) {
            setIsFetchingMore(true)
        } else {
            setLoading(true)
        }

        console.log(`Fetching products... Page: ${pageNumber}, Reset: ${isReset}`)

        // Get category ID from slug
        let categoryId: string | null = null
        if (selectedCategory) {
            const cat = categories.find(c => c.slug === selectedCategory)
            if (cat) {
                categoryId = cat.id
            } else {
                // Category selected but not found (likely inactive or empty)
                // Return empty result instead of all products
                setProducts([])
                setHasMore(false)
                setLoading(false)
                setIsFetchingMore(false)
                return
            }
        }

        // Use server action for fetching (bypasses RLS, includes variations)
        const { paginateShopProducts } = await import('@/app/actions/getShopData')
        const { products: newProducts, totalProducts } = await paginateShopProducts(
            categoryId,
            pageNumber,
            PRODUCTS_PER_PAGE,
            sortBy,
            debouncedSearchQuery
        )

        if (isReset) {
            setProducts(newProducts)
        } else {
            setProducts(prev => [...prev, ...newProducts])
        }

        // Check if we reached the end
        if (newProducts.length < PRODUCTS_PER_PAGE) {
            setHasMore(false)
        } else {
            setHasMore(true)
        }

        if (isLoadingMore) {
            setIsFetchingMore(false)
        } else {
            setLoading(false)
        }
    }

    const loadMore = () => {
        const nextPage = page + 1
        setPage(nextPage)
        fetchProducts(nextPage, false)
    }

    const getPageTitle = () => {
        if (searchQuery) return `Results for "${searchQuery}"`
        if (selectedCategory) {
            const cat = categories.find(c => c.slug === selectedCategory)
            if (cat) return cat.name

            // Fallback: Format the slug (e.g. "mobile-accessories" -> "Mobile Accessories")
            return selectedCategory
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
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
                onSelectCategory={handleCategorySelect}
            />

            <div className="max-w-7xl mx-auto px-4 py-3 md:py-8">
                <Breadcrumbs
                    selectedCategory={selectedCategory}
                    categories={categories}
                    onCategorySelect={handleCategorySelect}
                />
                {/* Dynamic Category Header */}
                <div className="mb-6 md:mb-8">
                    {selectedCategory ? (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-700 p-3 md:p-8 text-white shadow-xl flex flex-row items-center justify-between gap-3 md:gap-6">
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/10 rounded-full blur-3xl" />

                            <div className="relative z-10 flex-1 min-w-0">
                                <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-tight line-clamp-2 md:line-clamp-none">
                                    {getPageTitle()}
                                </h1>
                                <p className="text-emerald-100 text-sm md:text-base leading-relaxed hidden md:block mt-2">
                                    Explore our premium collection of wholesale {getPageTitle().toLowerCase()}. Directly from verified manufacturers.
                                </p>
                            </div>

                            {(() => {
                                const currentCat = categories.find(c => c.slug === selectedCategory)
                                // Only show download button if:
                                // 1. Category exists
                                // 2. It has NO subcategories (it is a leaf node)
                                // This prevents downloading generic catalogs for parent categories like "Mobile Accessories"
                                const hasSubcategories = currentCat && categories.some(c => c.parent_id === currentCat.id)

                                if (currentCat && !hasSubcategories) {
                                    return (
                                        <div className="relative z-10 shrink-0">
                                            <DownloadCatalogButton
                                                categoryId={currentCat.id}
                                                categoryName={getPageTitle()}
                                                source="category"
                                                variant="primary"
                                                className="shadow-lg shadow-black/10 bg-white text-emerald-800 hover:bg-emerald-50 md:w-auto text-xs md:text-sm"
                                            />
                                        </div>
                                    )
                                }
                                return null
                            })()}
                        </div>
                    ) : (
                        <div className="flex items-end justify-between border-b border-gray-100 pb-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                                    All Products
                                </h1>
                                <p className="text-gray-500 mt-1">
                                    Browse our complete catalog of wholesale supplies
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Subcategory Navigation */}
                {(() => {
                    const currentCat = categories.find(c => c.slug === selectedCategory)
                    if (currentCat) {
                        const subCategories = categories.filter(c => c.parent_id === currentCat.id)
                        if (subCategories.length > 0) {
                            return (
                                <div className="mt-6 mb-8">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3 px-1">Shop by Category</h3>
                                    <div className="flex overflow-x-auto pb-6 px-2 gap-4 no-scrollbar">
                                        {subCategories.map(sub => {
                                            const isActive = sub.slug === selectedCategory
                                            return (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => handleCategorySelect(sub.slug)}
                                                    className={`flex flex-col items-center gap-2 group min-w-[80px] transition-all duration-300 ${isActive ? 'scale-105' : 'hover:-translate-y-1'}`}
                                                >
                                                    <div className={`
                                                        w-16 h-16 relative rounded-full overflow-hidden bg-white border transition-all duration-300
                                                        ${isActive
                                                            ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-lg shadow-emerald-100'
                                                            : 'border-gray-200 group-hover:border-emerald-300 group-hover:shadow-md'
                                                        }
                                                    `}>
                                                        {(() => {
                                                            const generatedImg = getCategoryImage(sub.name)
                                                            if (generatedImg) return (
                                                                <Image
                                                                    src={generatedImg}
                                                                    alt={sub.name}
                                                                    fill
                                                                    className={`object-cover p-2 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                                                                />
                                                            )
                                                            if (sub.image_url) return (
                                                                <Image
                                                                    src={sub.image_url}
                                                                    alt={sub.name}
                                                                    fill
                                                                    className="object-cover"
                                                                />
                                                            )
                                                            return (
                                                                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-emerald-600 font-bold">
                                                                    {sub.name.charAt(0)}
                                                                </div>
                                                            )
                                                        })()}
                                                    </div>
                                                    <span className={`
                                                        text-xs text-center line-clamp-2 w-full transition-colors duration-200
                                                        ${isActive ? 'font-bold text-emerald-700' : 'font-medium text-gray-600 group-hover:text-emerald-600'}
                                                    `}>
                                                        {sub.name}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        }
                    }
                    return null
                })()}

                <div className="flex gap-8 items-start mt-4">
                    {/* Desktop Sidebar */}
                    <CategorySidebar
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={handleCategorySelect}
                        className="hidden lg:block sticky top-32"
                    />

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">

                        {/* Products Grid */}
                        {loading && page === 1 ? (
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
                        ) : products.length === 0 ? (
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
                                        router.push('/products')
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
                                        Showing <span className="text-gray-900 font-bold">{products.length}</span> products
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                                    {products.map(product => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            wishlist={wishlist}
                                            onToggleWishlist={toggleWishlist}
                                        />
                                    ))}
                                </div>

                                {/* Infinite Scroll Trigger / Spinner */}
                                <div ref={ref} className="py-8 flex justify-center w-full">
                                    {isFetchingMore ? (
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                                    ) : (
                                        !hasMore && products.length > 0 && (
                                            <p className="text-gray-400 text-sm">You&apos;ve reached the end</p>
                                        )
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
