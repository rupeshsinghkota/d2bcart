'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Grid, User, ShoppingCart, Package } from 'lucide-react'
import { useStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { User as UserType } from '@/types'

export default function BottomNav() {
    const pathname = usePathname()
    const [user, setUser] = React.useState<UserType | null>(null)
    const cart = useStore((state) => state.cart)

    React.useEffect(() => {
        checkUser()
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

    // Don't show on login/register pages or if not authenticated (optional, but requested for App feel)
    // Actually, user said "web app feel", often bottoms navs are present even for guests
    // But let's keep it simple for now, show for everyone but context aware.
    if (pathname === '/login' || pathname === '/register') return null

    const isActive = (path: string) => pathname === path

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 px-4 pb-safe pt-2">
            <div className="flex justify-between items-center h-16">
                <Link
                    href="/"
                    className={`flex flex-col items-center gap-1 min-w-[60px] ${isActive('/') ? 'text-emerald-600' : 'text-gray-500'}`}
                >
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Home</span>
                </Link>

                <Link
                    href="/categories"
                    className={`flex flex-col items-center gap-1 min-w-[60px] ${isActive('/categories') ? 'text-emerald-600' : 'text-gray-500'}`}
                >
                    <Grid className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Categories</span>
                </Link>

                {user?.user_type === 'retailer' && (
                    <Link
                        href="/cart"
                        className={`flex flex-col items-center gap-1 min-w-[60px] relative ${isActive('/cart') ? 'text-emerald-600' : 'text-gray-500'}`}
                    >
                        <div className="relative">
                            <ShoppingCart className="w-6 h-6" />
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                                    {cart.length}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-medium">Cart</span>
                    </Link>
                )}

                {user?.user_type === 'manufacturer' && (
                    <Link
                        href="/manufacturer/orders"
                        className={`flex flex-col items-center gap-1 min-w-[60px] ${isActive('/manufacturer/orders') ? 'text-emerald-600' : 'text-gray-500'}`}
                    >
                        <Package className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Orders</span>
                    </Link>
                )}

                <Link
                    href={user ? (user.user_type === 'admin' ? '/admin' : `/${user.user_type}`) : '/login'}
                    className={`flex flex-col items-center gap-1 min-w-[60px] ${pathname.includes(user?.user_type || 'login') ? 'text-emerald-600' : 'text-gray-500'}`}
                >
                    <User className="w-6 h-6" />
                    <span className="text-[10px] font-medium">{user ? 'Account' : 'Login'}</span>
                </Link>
            </div>
        </div>
    )
}
