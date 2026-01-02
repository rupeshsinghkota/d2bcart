'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation' // Added useRouter
import { supabase } from '@/lib/supabase'
import { Product, Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Search, Filter, Package, MapPin, Heart, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { CategorySidebar } from '@/components/product/CategorySidebar'
import { useStore } from '@/lib/store'

import { MobileFilterBar } from '@/components/product/MobileFilterBar'
import { MobileCategorySheet } from '@/components/product/MobileCategorySheet'
import { ProductCard } from '@/components/product/ProductCard'

interface ProductsClientProps {
    initialProducts: Product[]
    initialCategories: Category[]
    initialSelectedCategory: string
}

export default function ProductsClient({
    initialProducts,
    initialCategories,
    initialSelectedCategory
}: ProductsClientProps) {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Initialize state with server-provided prop
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [categories, setCategories] = useState<Category[]>(initialCategories)
    const [loading, setLoading] = useState(false) // Initially false as we have data
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
    const [selectedCategory, setSelectedCategory] = useState<string>(initialSelectedCategory)
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
        if (category !== null && category !== selectedCategory) {
            setSelectedCategory(category)
        }
    }, [searchParams])

    // Fetch Only if params change significantly or component specifically needs update
    // We skip the initial fetch because we have `initialProducts`
    // But if `selectedCategory` or `sortBy` changes in Client state, we must fetch

    useEffect(() => {
        // Only fetch if we are NOT in the initial state match
        // Or honestly, just fetching is safer to ensure consistent sort/filter behavior
        // But to avoid double-fetch on mount:
        const isInitialMount = initialProducts.length > 0 && selectedCategory === initialSelectedCategory && sortBy === 'newest';

        if (!isInitialMount) {
            fetchProducts()
        }

        // Fetch categories is not needed as we have them from props, 
        // but if we want to keep them fresh we could. 
        // For now, let's trust server props.

        fetchWishlist()
    }, [selectedCategory, sortBy])

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

    // Handle Category Handling Wrapper
    const handleCategorySelect = (slug: string) => {
        setSelectedCategory(slug)
        // Update URL shallowly so back button works and URL is shareable
        const params = new URLSearchParams(searchParams.toString())
        if (slug) {
            params.set('category', slug)
        } else {
            params.delete('category')
        }
        router.push(`/products?${params.toString()}`)
    }

    const fetchProducts = async () => {
        setLoading(true)
        let query = supabase
            .from('products')
            .select(`
                *,
                manufacturer:users!products_manufacturer_id_fkey(business_name, city, is_verified),
                category:categories!products_category_id_fkey(name, slug)
            `)
            .eq('is_active', true)

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
                // We reuse the passed 'categories' prop to find descendants to avoid extra network call if possible?
                // But relying on API is more robust in this function scope for now.
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
                onSelectCategory={handleCategorySelect}
            />

            <div className="max-w-7xl mx-auto px-4 py-3 md:py-8">
                <Breadcrumbs
                    selectedCategory={selectedCategory}
                    categories={categories}
                    onCategorySelect={handleCategorySelect}
                />

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
                                        Showing <span className="text-gray-900 font-bold">{filteredProducts.length}</span> products
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                                    {filteredProducts.map(product => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            wishlist={wishlist}
                                            onToggleWishlist={toggleWishlist}
                                        />
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
