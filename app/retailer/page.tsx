'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Order, User } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
    ShoppingBag,
    Package,
    TrendingUp,
    Clock,
    Eye,
    MapPin,
    User as UserIcon
} from 'lucide-react'

export default function RetailerDashboard() {
    const [user, setUser] = useState<User | null>(null)
    const [orders, setOrders] = useState<Order[]>([])
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        totalSpent: 0,
        deliveredOrders: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        if (!isSupabaseConfigured) {
            setLoading(false)
            return
        }

        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
            setLoading(false)
            return
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()

        if (profile) setUser(profile as User)

        // Get orders
        const { data: ordersData } = await supabase
            .from('orders')
            .select(`
        *,
        product:products(name, images),
        manufacturer:users!orders_manufacturer_id_fkey(business_name, city)
      `)
            .eq('retailer_id', authUser.id)
            .order('created_at', { ascending: false })

        if (ordersData) {
            setOrders(ordersData as Order[])

            // Calculate stats
            const pending = ordersData.filter(o => ['pending', 'paid', 'confirmed'].includes(o.status)).length
            const delivered = ordersData.filter(o => o.status === 'delivered').length
            const totalSpent = ordersData.reduce((sum, o) => sum + o.total_amount, 0)

            setStats({
                totalOrders: ordersData.length,
                pendingOrders: pending,
                deliveredOrders: delivered,
                totalSpent
            })
        }

        setLoading(false)
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-gray-100 text-gray-700',
            paid: 'bg-yellow-100 text-yellow-700',
            confirmed: 'bg-blue-100 text-blue-700',
            shipped: 'bg-purple-100 text-purple-700',
            delivered: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700'
        }
        return styles[status] || 'bg-gray-100 text-gray-700'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Welcome, {user?.business_name || 'Retailer'}
                        </h1>
                        <p className="text-gray-600">Manage your orders and explore products</p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/retailer/profile"
                            className="btn-secondary flex items-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                        >
                            <UserIcon className="w-5 h-5" />
                            Profile
                        </Link>
                        <Link href="/products" className="btn-primary">
                            Browse Products
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <ShoppingBag className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                                <div className="text-gray-500 text-sm">Total Orders</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <Clock className="w-6 h-6 text-yellow-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.pendingOrders}</div>
                                <div className="text-gray-500 text-sm">Pending</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.deliveredOrders}</div>
                                <div className="text-gray-500 text-sm">Delivered</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 shadow-sm text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</div>
                                <div className="text-emerald-100 text-sm">Total Spent</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl shadow-sm">
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="font-semibold text-lg">Recent Orders</h2>
                        <Link href="/retailer/orders" className="text-emerald-600 text-sm hover:underline">
                            View All
                        </Link>
                    </div>

                    {orders.length === 0 ? (
                        <div className="p-12 text-center">
                            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 mb-4">No orders yet</p>
                            <Link href="/products" className="text-emerald-600 hover:underline">
                                Start shopping
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {orders.slice(0, 5).map(order => (
                                <div key={order.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        {(order as any).product?.images?.[0] ? (
                                            <img
                                                src={(order as any).product.images[0]}
                                                alt=""
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        ) : (
                                            <Package className="w-6 h-6 text-gray-400" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm text-gray-500">
                                                {order.order_number}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <h3 className="font-medium text-gray-900 truncate mt-1">
                                            {(order as any).product?.name}
                                        </h3>
                                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                                            <MapPin className="w-3 h-3" />
                                            {(order as any).manufacturer?.business_name}, {(order as any).manufacturer?.city}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="font-bold text-gray-900">
                                            {formatCurrency(order.total_amount)}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {order.quantity} units
                                        </div>
                                    </div>

                                    <Link
                                        href={`/retailer/orders/${order.id}`}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <Eye className="w-5 h-5 text-gray-400" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
