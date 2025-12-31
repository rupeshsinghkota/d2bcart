'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Package, TrendingUp, AlertCircle, IndianRupee } from 'lucide-react'

export default function ManufacturerHome({ user }: { user: any }) {
    const [stats, setStats] = useState({
        pendingOrders: 0,
        revenue: 0,
        lowStock: 0
    })

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        // Mock stats for now or fetching real data if API allows easily
        // Fetching Real Data:
        const { count: pending } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('manufacturer_id', user.id)
            .eq('status', 'pending')

        // Simple aggregate for revenue (needs more complex query in real app or RPC)
        const { data: orders } = await supabase.from('orders').select('base_price').eq('manufacturer_id', user.id).neq('status', 'cancelled')
        const revenue = orders?.reduce((sum, o) => sum + (o.base_price || 0), 0) || 0

        setStats({
            pendingOrders: pending || 0,
            revenue: revenue,
            lowStock: 5 // Placeholder
        })
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.first_name || 'Partner'}!</h1>
                <Link href="/manufacturer/orders" className="btn-primary text-sm">
                    View Orders
                </Link>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Pending Orders</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                        <IndianRupee className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">₹{stats.revenue.toLocaleString()}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Low Stock Items</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
                    </div>
                </div>
            </div>

            {/* Action Cards */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
                    <h3 className="text-xl font-bold mb-2">Add New Products</h3>
                    <p className="text-gray-400 mb-6 text-sm">Expand your catalog to reach more retailers.</p>
                    <Link href="/manufacturer/add-product" className="bg-white text-gray-900 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100">
                        + Add Product
                    </Link>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                    <h3 className="text-xl font-bold mb-2 text-gray-900">Inventory Status</h3>
                    <p className="text-gray-500 mb-6 text-sm">Keep your stock updated to avoid order cancellations.</p>
                    <Link href="/manufacturer/inventory" className="text-emerald-600 font-semibold text-sm hover:underline">
                        Manage Inventory →
                    </Link>
                </div>
            </div>
        </div>
    )
}
