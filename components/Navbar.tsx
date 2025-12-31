'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
    ShoppingCart,
    User,
    Menu,
    X,
    Package,
    Store,
    LogOut
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import { User as UserType } from '@/types'

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [user, setUser] = useState<UserType | null>(null)
    const [loading, setLoading] = useState(true)
    const cart = useStore((state) => state.cart)

    useEffect(() => {
        checkUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                checkUser()
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                useStore.getState().setUser(null)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const checkUser = async () => {
        if (!isSupabaseConfigured) {
            setLoading(false)
            return
        }
        try {
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
        } catch (error) {
            console.log('Not logged in')
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        useStore.getState().setUser(null)
        window.location.href = '/'
    }

    const getDashboardLink = () => {
        if (!user) return '/login'
        if (user.email === 'rupeshsingh1103@gmail.com') return '/admin'
        if (user.user_type === 'manufacturer') return '/manufacturer'
        if (user.user_type === 'retailer') return '/retailer'
        if (user.user_type === 'admin') return '/admin'
        return '/'
    }

    return (
        <nav className="bg-white shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href={getDashboardLink()} className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">D2B</span>
                        </div>
                        <span className="font-bold text-xl text-gray-900">D2BCart</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        <Link href="/products" className="text-gray-600 hover:text-emerald-600 transition-colors">
                            Products
                        </Link>
                        <Link href="/categories" className="text-gray-600 hover:text-emerald-600 transition-colors">
                            Categories
                        </Link>

                        {!loading && (
                            <>
                                {user ? (
                                    <div className="flex items-center gap-4">
                                        <Link
                                            href={getDashboardLink()}
                                            className="flex items-center gap-2 text-gray-600 hover:text-emerald-600"
                                        >
                                            {user.user_type === 'manufacturer' ? (
                                                <Package className="w-5 h-5" />
                                            ) : (
                                                <Store className="w-5 h-5" />
                                            )}
                                            Dashboard
                                        </Link>

                                        {user.user_type === 'retailer' && (
                                            <Link href="/cart" className="relative">
                                                <ShoppingCart className="w-6 h-6 text-gray-600 hover:text-emerald-600" />
                                                {cart.length > 0 && (
                                                    <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                                                        {cart.length}
                                                    </span>
                                                )}
                                            </Link>
                                        )}

                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-2 text-gray-600 hover:text-red-600"
                                        >
                                            <LogOut className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Link href="/login" className="text-gray-600 hover:text-emerald-600">
                                            Login
                                        </Link>
                                        <Link href="/register" className="btn-primary !py-2 !px-4">
                                            Register
                                        </Link>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden py-4 border-t animate-fade-in">
                        <div className="flex flex-col gap-4">
                            <Link href="/products" className="text-gray-600">Products</Link>
                            <Link href="/categories" className="text-gray-600">Categories</Link>
                            {user ? (
                                <>
                                    <Link href={getDashboardLink()} className="text-gray-600">Dashboard</Link>
                                    <button onClick={handleLogout} className="text-left text-red-600">Logout</button>
                                </>
                            ) : (
                                <>
                                    <Link href="/login" className="text-gray-600">Login</Link>
                                    <Link href="/register" className="text-emerald-600 font-semibold">Register</Link>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
