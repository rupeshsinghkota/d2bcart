'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Search, X, Loader2, ChevronRight, TrendingUp } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { getInstantSearchResults } from '@/app/actions/getShopData'
import { Product, Category } from '@/types'

interface SearchResult {
    products: Product[]
    categories: Category[]
    brands: string[]
}

export default function InstantSearch() {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult>({ products: [], categories: [], brands: [] })
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const debouncedQuery = useDebounce(query, 300)

    // Handle outside click to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Fetch results when debounced query changes
    useEffect(() => {
        const fetchResults = async () => {
            if (debouncedQuery.length < 2) {
                setResults({ products: [], categories: [], brands: [] })
                return
            }

            setIsLoading(true)
            try {
                const data = await getInstantSearchResults(debouncedQuery)
                setResults(data)
                setIsOpen(true)
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchResults()
    }, [debouncedQuery])

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!query.trim()) return

        setIsOpen(false)
        router.push(`/products?search=${encodeURIComponent(query)}`)
        inputRef.current?.blur()
    }

    const clearSearch = () => {
        setQuery('')
        setResults({ products: [], categories: [], brands: [] })
        setIsOpen(false)
        inputRef.current?.focus()
    }

    return (
        <div ref={containerRef} className="relative w-full max-w-xl">
            {/* Search Input */}
            <form onSubmit={handleSubmit} className="relative z-50">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        if (e.target.value.length >= 2) setIsOpen(true)
                    }}
                    onFocus={() => {
                        if (query.length >= 2) setIsOpen(true)
                    }}
                    placeholder="Search for products, brands..."
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 focus:border-emerald-500 rounded-xl text-sm transition-all outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
                />
                <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isOpen ? 'text-emerald-500' : 'text-gray-400'}`} />

                {query && (
                    <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-all"
                    >
                        {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                        ) : (
                            <X className="w-3.5 h-3.5" />
                        )}
                    </button>
                )}
            </form>

            {/* Backdrop for Mobile */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 md:hidden" onClick={() => setIsOpen(false)} />
            )}

            {/* Dropdown Results */}
            {isOpen && (results.products.length > 0 || results.categories.length > 0 || results.brands.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">

                        {/* Brands Section */}
                        {results.brands.length > 0 && (
                            <div className="p-2 border-b border-gray-50">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1">Brands</div>
                                <div className="flex flex-wrap gap-2 px-2">
                                    {results.brands.map(brand => (
                                        <button
                                            key={brand}
                                            onClick={() => {
                                                setQuery(brand)
                                                router.push(`/products?search=${encodeURIComponent(brand)}`)
                                                setIsOpen(false)
                                            }}
                                            className="px-3 py-1.5 bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 rounded-lg text-xs font-medium transition-colors border border-gray-100 hover:border-emerald-100"
                                        >
                                            {brand}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Categories Section */}
                        {results.categories.length > 0 && (
                            <div className="py-2 border-b border-gray-50">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-1 mb-1">Categories</div>
                                {results.categories.map(cat => (
                                    <Link
                                        key={cat.id}
                                        href={`/products?category=${cat.id}`}
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 group cursor-pointer"
                                    >
                                        <span className="text-sm text-gray-700 font-medium group-hover:text-emerald-600 transition-colors">
                                            {cat.name}
                                        </span>
                                        <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-emerald-400" />
                                    </Link>
                                ))}
                            </div>
                        )}

                        {/* Products Section */}
                        {results.products.length > 0 && (
                            <div className="py-2">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 py-1 mb-1">Top Matches</div>
                                {results.products.map(product => (
                                    <Link
                                        key={product.id}
                                        href={`/products/${product.slug || product.id}`}
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50/50 group transition-colors"
                                    >
                                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-white shrink-0">
                                            {product.images?.[0] ? (
                                                <Image
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    fill
                                                    className="object-contain"
                                                    sizes="40px"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                                                    <Search className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                                                {product.name}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-emerald-600 font-bold">₹{product.display_price}</span>
                                                {product.moq && (
                                                    <span className="text-gray-400">MOQ: {product.moq}</span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        <div
                            onClick={() => handleSubmit()}
                            className="p-3 bg-gray-50 border-t border-gray-100 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                            <span className="text-xs font-medium text-emerald-600 flex items-center justify-center gap-1.5">
                                See all results for "{query}" <ArrowRight className="w-3 h-3" />
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ArrowRight(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}
