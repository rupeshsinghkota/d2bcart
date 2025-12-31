'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Order } from '@/types'
import {
    TrendingUp,
    Package,
    Users,
    ShoppingBag,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Factory,
    Store,
    Eye
} from 'lucide-react'

interface AdminStats {
    totalProducts: number
    totalManufacturers: number
    totalRetailers: number
    totalOrders: number
    totalGMV: number
    platformProfit: number
    pendingPayouts: number
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats>({
        totalProducts: 0,
        totalManufacturers: 0,
        totalRetailers: 0,
        totalOrders: 0,
        totalGMV: 0,
        platformProfit: 0,
        pendingPayouts: 0
    })
    const [recentOrders, setRecentOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        // Fetch products count
        const { count: productsCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })

        // Fetch users count by type
        // Fetch users count by type
        const { data: usersData } = await supabase
            .from('users')
            .select('user_type') as { data: { user_type: string }[] | null }

        const manufacturers = usersData?.filter(u => u.user_type === 'manufacturer').length || 0
        const retailers = usersData?.filter(u => u.user_type === 'retailer').length || 0

        // Fetch orders
        const { data: ordersData } = await supabase
            .from('orders')
            .select(`
                *,
                product:products(name),
                retailer:users!orders_retailer_id_fkey(business_name),
                manufacturer:users!orders_manufacturer_id_fkey(business_name)
            `)
            .order('created_at', { ascending: false }) as { data: Order[] | null }

        const totalGMV = ordersData?.reduce((sum, o) => sum + o.total_amount, 0) || 0
        const platformProfit = ordersData?.reduce((sum, o) => sum + o.platform_profit, 0) || 0
        const pendingPayouts = ordersData
            ?.filter(o => o.status === 'delivered')
            .reduce((sum, o) => sum + o.manufacturer_payout, 0) || 0

        setStats({
            totalProducts: productsCount || 0,
            totalManufacturers: manufacturers,
            totalRetailers: retailers,
            totalOrders: ordersData?.length || 0,
            totalGMV,
            platformProfit,
            pendingPayouts
        })

        setRecentOrders(ordersData?.slice(0, 10) || [])
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
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-600">D2BCart Platform Overview</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                                <div className="text-gray-500 text-sm">Products</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Factory className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalManufacturers}</div>
                                <div className="text-gray-500 text-sm">Manufacturers</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Store className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalRetailers}</div>
                                <div className="text-gray-500 text-sm">Retailers</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <ShoppingBag className="w-6 h-6 text-yellow-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                                <div className="text-gray-500 text-sm">Orders</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Revenue Stats */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="text-gray-500 text-sm mb-1">Total GMV</div>
                        <div className="text-3xl font-bold text-gray-900">
                            {formatCurrency(stats.totalGMV)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-green-600 mt-2">
                            <ArrowUpRight className="w-4 h-4" />
                            <span>Gross Merchandise Value</span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 shadow-sm text-white">
                        <div className="text-emerald-100 text-sm mb-1">Platform Profit 💰</div>
                        <div className="text-3xl font-bold">
                            {formatCurrency(stats.platformProfit)}
                        </div>
                        <div className="text-emerald-200 text-sm mt-2">
                            Your total earnings from markup
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="text-gray-500 text-sm mb-1">Pending Payouts</div>
                        <div className="text-3xl font-bold text-orange-600">
                            {formatCurrency(stats.pendingPayouts)}
                        </div>
                        <div className="text-sm text-gray-500 mt-2">
                            To manufacturers (delivered orders)
                        </div>
                    </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl shadow-sm">
                    <div className="p-6 border-b flex justify-between items-center">
                        <h2 className="font-semibold text-lg">Recent Orders</h2>
                        <Link href="/admin/orders" className="text-emerald-600 text-sm hover:underline">
                            View All
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retailer → Manufacturer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Your Profit</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {recentOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-sm">{order.order_number}</div>
                                            <div className="text-xs text-gray-500">{order.product?.name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="text-gray-900">{order.retailer?.business_name}</span>
                                            <span className="text-gray-400 mx-2">→</span>
                                            <span className="text-gray-900">{order.manufacturer?.business_name}</span>
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {formatCurrency(order.total_amount)}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-emerald-600">
                                            {formatCurrency(order.platform_profit)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                href="/admin/orders"
                                                className="text-emerald-600 hover:underline text-sm"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
