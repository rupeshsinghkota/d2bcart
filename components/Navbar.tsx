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
        if (!user) return '/login'
        if (user.email === 'rupeshsingh1103@gmail.com') return '/admin'
        return `/${user.user_type}`
    }

    return (
        <nav className="bg-white shadow-sm sticky top-0 z-40 h-16">
            <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">

                {/* 1. Logo Section */}
                <Link href={getDashboardLink()} className="flex items-center gap-2 shrink-0">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-emerald-200">
                        D
                    </div>
                    {/* Hide full name on small mobile if search is active? No, keep it short. */}
                    <span className="font-bold text-lg md:text-xl text-gray-900 hidden sm:block">D2BCart</span>
                </Link>

                {/* 2. Global Search Bar (Centered & Flexible) */}
                <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative group">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search for products, brands and more"
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:border-emerald-500 rounded-lg text-sm transition-all outline-none border ring-0"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500" />
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

                            {/* Cart (Retailer Only) */}
                            {user.user_type === 'retailer' && (
                                <Link href="/cart" className="flex flex-col items-center text-gray-600 hover:text-emerald-600 relative">
                                    <div className="relative">
                                        <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
                                        {cart.length > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                                                {cart.length}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-medium mt-0.5 hidden md:block">Cart</span>
                                </Link>
                            )}

                            {/* Profile Dropdown / Link */}
                            <Link href={getDashboardLink()} className="hidden md:flex items-center gap-2 ml-2">
                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
                                    {user.business_name?.[0]?.toUpperCase() || 'U'}
                                </div>
                            </Link>
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
