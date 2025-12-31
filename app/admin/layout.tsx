'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    CreditCard,
    LogOut,
    Users,
    Package
} from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [loading, setLoading] = useState(true)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        checkAdmin()
    }, [])

    const checkAdmin = async () => {
        console.log('Checking Admin Access...')
        const { data: { user }, error } = await supabase.auth.getUser()

        console.log('Auth check result:', { userEmail: user?.email, error })

        if (!user) {
            console.log('No user found, redirecting to login')
            router.push('/login')
            return
        }

        if (user.email !== 'rupeshsingh1103@gmail.com') {
            console.log('User is not admin, redirecting home')
            alert('Access Denied: This area is restricted to Administrators.')
            router.push('/')
            return
        }

        console.log('Admin access granted')
        setLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) return null

    const navItems = [
        // { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Orders', href: '/admin/orders', icon: Package },
        { name: 'Payouts', href: '/admin/payouts', icon: CreditCard },
        { name: 'Users', href: '/admin/users', icon: Users },
    ]

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-200 ease-in-out
                md:translate-x-0 md:static md:shadow-md
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 border-b flex justify-between items-center">
                    <h1 className="text-xl font-bold text-emerald-600">Admin Panel</h1>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="md:hidden text-gray-500 hover:text-gray-700"
                    >
                        <LogOut className="w-5 h-5 rotate-180" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${pathname === item.href
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t mt-auto">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="md:hidden p-4 bg-white shadow-sm flex items-center gap-3 sticky top-0 z-30">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <LayoutDashboard className="w-6 h-6" />
                    </button>
                    <span className="font-semibold text-gray-900">Admin Panel</span>
                </div>
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
