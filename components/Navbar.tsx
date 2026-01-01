'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ShoppingCart,
    User,
    Menu,
    Search,
    Heart,
    LogOut,
    Store,
    Package
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { User as UserType } from '@/types'

export default function Navbar() {
    const router = useRouter()
    const [user, setUser] = useState<UserType | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const cart = useStore((state) => state.cart)
    const [isMenuOpen, setIsMenuOpen] = useState(false) // Keeping for desktop sidebar trigger if needed later

    useEffect(() => {
        checkUser()
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') checkUser()
            else if (event === 'SIGNED_OUT') {
                setUser(null)
                useStore.getState().setUser(null)
            }
        })
        return () => subscription.unsubscribe()
    }, [])

    const checkUser = async () => {
        if (!isSupabaseConfigured) return
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()
            if (profile) {
                setUser(profile as UserType)
                useStore.getState().setUser(profile as UserType)
            }
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchQuery.trim()) {
            router.push(`/products?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    const getDashboardLink = () => {
        if (!user) return '/'
        if (user.email === 'rupeshsingh1103@gmail.com') return '/admin'
        if (user.user_type === 'manufacturer') return '/manufacturer'
        if (user.user_type === 'retailer') return '/retailer'
        return '/'
    }

    return (
        <nav className="bg-white shadow-sm sticky top-0 z-50">
            {/* Main Header Row */}
            <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-3 sm:gap-4">

                {/* 1. Logo Section */}
                <Link href="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0 group">
                    <div className="relative">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/20">
                            <span className="text-white font-black text-sm sm:text-base md:text-lg">D</span>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-emerald-400 rounded-full border-[1.5px] border-white"></div>
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="font-bold text-sm sm:text-base md:text-lg text-gray-900 tracking-tight">D2B<span className="text-emerald-600">Cart</span></span>
                        <span className="hidden sm:block text-[8px] text-gray-400 font-medium tracking-wide uppercase">B2B Marketplace</span>
                    </div>
                </Link>

                {/* 2. Search Bar - Flexible Width */}
                <form onSubmit={handleSearch} className="flex-1 min-w-0">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-9 pr-3 py-2 sm:py-2.5 bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 focus:border-emerald-500 rounded-full text-sm transition-all outline-none focus:ring-2 focus:ring-emerald-500/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                </form>

                {/* 3. Action Icons (Right Side) */}
                <div className="flex items-center gap-3 md:gap-5 shrink-0">

                    {user ? (
                        <>
                            {/* Dashboard Role Icon (Hidden on mobile as it's in bottom nav) */}
                            <Link href={getDashboardLink()} className="hidden md:flex flex-col items-center text-gray-600 hover:text-emerald-600">
                                {user.user_type === 'manufacturer' ? <Package className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                                <span className="text-xs font-medium mt-0.5">Dashboard</span>
                            </Link>

                            {/* Wishlist (Retailer Only) */}
                            {user.user_type === 'retailer' && (
                                <Link href="/retailer/wishlist" className="hidden md:flex flex-col items-center text-gray-600 hover:text-emerald-600">
                                    <Heart className="w-5 h-5" />
                                    <span className="text-xs font-medium mt-0.5">Wishlist</span>
                                </Link>
                            )}

                            {/* Cart (Retailer Only - Hidden on mobile as it's in bottom nav) */}
                            {user.user_type === 'retailer' && (
                                <Link href="/cart" className="hidden md:flex flex-col items-center text-gray-600 hover:text-emerald-600 relative">
                                    <div className="relative">
                                        <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
                                        {cart.length > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                                                {cart.length}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-medium mt-0.5">Cart</span>
                                </Link>
                            )}

                            {/* Profile Dropdown */}
                            <div className="relative hidden md:block">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="flex items-center gap-2 ml-2 focus:outline-none"
                                >
                                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold border border-emerald-200 hover:border-emerald-400 transition-colors">
                                        {user.business_name?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                </button>

                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-100 ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-3 border-b border-gray-50">
                                            <p className="text-sm font-medium text-gray-900 truncate">{user.business_name}</p>
                                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                        </div>

                                        <Link
                                            href="/retailer/profile"
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            <User className="w-4 h-4" />
                                            My Profile
                                        </Link>

                                        <Link
                                            href={getDashboardLink()}
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            {user.user_type === 'manufacturer' ? <Package className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                                            Dashboard
                                        </Link>

                                        <button
                                            onClick={async () => {
                                                await supabase.auth.signOut()
                                                setIsMenuOpen(false)
                                                setUser(null)
                                                useStore.getState().setUser(null)
                                                router.push('/login')
                                            }}
                                            className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-emerald-600 whitespace-nowrap">
                                Login
                            </Link>
                            <Link href="/register" className="hidden sm:block btn-primary !py-2 !px-4 !text-sm whitespace-nowrap">
                                Sell / Buy
                            </Link>
                        </div>
                    )}

                </div>
            </div>
        </nav>
    )
}
