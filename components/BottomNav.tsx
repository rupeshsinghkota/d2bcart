'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, User, ShoppingCart, Package, Search, Store, Menu } from 'lucide-react'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { User as UserType } from '@/types'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const MobileMenu = dynamic(() => import('./MobileMenu'), { ssr: false })

export default function BottomNav() {
    const pathname = usePathname()
    // Use global store
    const user = useStore((state) => state.user)
    const setUser = useStore((state) => state.setUser)
    const cart = useStore((state) => state.cart)

    React.useEffect(() => {
        if (!user) checkUser()
    }, [])

    const checkUser = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()
            if (profile) setUser(profile as UserType)
        }
    }

    const [isMenuOpen, setIsMenuOpen] = useState(false)

    // Don't show on login/register pages or product details (due to sticky action bars)
    // EXCEPTION: Show on Cart to allow escaping, but ProductDetail has its own bar.
    if (
        pathname === '/login' ||
        pathname === '/register' ||
        (pathname.startsWith('/products/') && pathname.split('/').length > 2) // Hide only on Product Detail
    ) return null

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/'
        return pathname.startsWith(path)
    }

    const navItems = [
        { href: '/', icon: Home, label: 'Home' },
        { href: '/categories', icon: LayoutGrid, label: 'Categories' },
        { href: '/products', icon: Store, label: 'Shop' },
    ]

    // Add role-specific item
    if (!user || user.user_type === 'retailer') {
        navItems.push({ href: '/cart', icon: ShoppingCart, label: 'Cart' })
    } else if (user?.user_type === 'manufacturer') {
        navItems.push({ href: '/manufacturer/orders', icon: Package, label: 'Orders' })
    }

    return (
        <>
            <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/80 z-[49] safe-area-inset-bottom">
                <div className="flex justify-around items-center h-16 px-2">
                    {navItems.map(item => {
                        const active = isActive(item.href)
                        const isCart = item.href === '/cart'

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative transition-colors ${active
                                    ? 'text-emerald-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <div className="relative">
                                    <item.icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : ''}`} />
                                    {isCart && cart.length > 0 && (
                                        <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                                            {cart.length > 9 ? '9+' : cart.length}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                                    {item.label}
                                </span>
                                {/* Active Indicator */}
                                {active && (
                                    <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-600 rounded-full"></div>
                                )}
                            </Link>
                        )
                    })}

                    {/* Menu Toggle Item */}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative transition-colors ${isMenuOpen
                            ? 'text-emerald-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Menu className={`w-5 h-5 ${isMenuOpen ? 'stroke-[2.5px]' : ''}`} />
                        <span className={`text-[10px] font-medium ${isMenuOpen ? 'font-semibold' : ''}`}>
                            Menu
                        </span>
                    </button>
                </div>
            </nav>
        </>
    )
}
