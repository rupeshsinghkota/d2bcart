'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    X,
    User,
    ShoppingBag,
    Heart,
    Settings,
    LogOut,
    HelpCircle,
    ChevronRight,
    Store,
    LayoutGrid,
    Package,
    Home
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/lib/store'
import Image from 'next/image'

interface MobileMenuProps {
    isOpen: boolean
    onClose: () => void
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
    const router = useRouter()
    const pathname = usePathname()
    const user = useStore((state) => state.user)
    const setUser = useStore((state) => state.setUser)
    const [animate, setAnimate] = useState(false)

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            setTimeout(() => setAnimate(true), 10)
        } else {
            setAnimate(false)
            setTimeout(() => {
                document.body.style.overflow = 'unset'
            }, 300)
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        onClose()
        router.push('/login')
    }

    if (!isOpen && !animate) return null

    const menuItems = [
        { icon: Home, label: 'Home', href: '/' },
        { icon: LayoutGrid, label: 'Categories', href: '/categories' },
        { icon: Store, label: 'All Products', href: '/products' },
    ]

    const retailerItems = [
        { icon: User, label: 'My Profile', href: '/retailer/profile' },
        { icon: ShoppingBag, label: 'My Orders', href: '/retailer/orders' },
        { icon: Heart, label: 'Wishlist', href: '/retailer/wishlist' },
        { icon: Store, label: 'Dashboard', href: '/retailer' },
    ]

    const manufacturerItems = [
        { icon: Package, label: 'Manage Orders', href: '/manufacturer/orders' },
        { icon: Store, label: 'Dashboard', href: '/manufacturer' },
    ]

    return (
        <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${animate ? 'opacity-100' : 'opacity-0'
                    }`}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div
                className={`absolute top-0 right-0 h-full w-[80%] max-w-[320px] bg-white shadow-2xl transition-transform duration-300 transform flex flex-col ${animate ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>

                    {user ? (
                        <div className="mt-4">
                            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold border-2 border-white/30 mb-3">
                                {user.business_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <h3 className="font-bold text-lg leading-tight line-clamp-1">{user.business_name}</h3>
                            <p className="text-emerald-100 text-sm mt-0.5">{user.email}</p>
                            <span className="inline-block mt-2 px-2 py-0.5 bg-white/20 rounded text-[10px] font-medium uppercase tracking-wider">
                                {user.user_type}
                            </span>
                        </div>
                    ) : (
                        <div className="mt-8">
                            <h3 className="font-bold text-xl mb-1">Welcome!</h3>
                            <p className="text-emerald-100 text-sm mb-4">Login to access your account</p>
                            <Link
                                href="/login"
                                onClick={onClose}
                                className="block w-full py-2.5 bg-white text-emerald-700 font-bold text-center rounded-lg shadow-lg"
                            >
                                Login / Register
                            </Link>
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto py-2">
                    {/* Main Navigation */}
                    <div className="px-3 py-2">
                        <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Menu</p>
                        {menuItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${pathname === item.href
                                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${pathname === item.href ? 'text-emerald-600' : 'text-gray-400'}`} />
                                <span className="flex-1">{item.label}</span>
                                <ChevronRight className="w-4 h-4 text-gray-300" />
                            </Link>
                        ))}
                    </div>

                    <div className="h-px bg-gray-100 mx-5 my-1" />

                    {/* Role Specific Links */}
                    {user && (
                        <div className="px-3 py-2">
                            <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Account</p>
                            {(user.user_type === 'retailer' ? retailerItems : manufacturerItems).map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onClose}
                                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${pathname === item.href
                                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <item.icon className={`w-5 h-5 ${pathname === item.href ? 'text-emerald-600' : 'text-gray-400'}`} />
                                    <span className="flex-1">{item.label}</span>
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="h-px bg-gray-100 mx-5 my-1" />

                    {/* Support & Settings */}
                    <div className="px-3 py-2">
                        <Link
                            href="/contact"
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <HelpCircle className="w-5 h-5 text-gray-400" />
                            <span className="flex-1">Help & Support</span>
                        </Link>

                        {user && (
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors text-left"
                            >
                                <LogOut className="w-5 h-5 opacity-70" />
                                <span className="flex-1 font-medium">Log Out</span>
                            </button>
                        )}
                    </div>
                </div>


            </div>
        </div>
    )
}
