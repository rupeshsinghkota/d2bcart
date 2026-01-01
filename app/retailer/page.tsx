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
    User as UserIcon,
    RefreshCcw,
    Download,
    ArrowRight
} from 'lucide-react'
import { SalesChart } from '@/components/analytics/SalesChart'
import { generateInvoice } from '@/lib/invoice-generator'

export default function RetailerDashboard() {
    const [user, setUser] = useState<User | null>(null)
    const [orders, setOrders] = useState<Order[]>([])
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        totalSpent: 0,
        deliveredOrders: 0
    })
    const [chartData, setChartData] = useState<any[]>([])
    const [buyAgainProducts, setBuyAgainProducts] = useState<any[]>([])
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
        manufacturer:users!orders_manufacturer_id_fkey(business_name, city, email, phone, address, state, pincode)
      `)
            .eq('retailer_id', authUser.id)
            .order('created_at', { ascending: false })

        if (ordersData) {
            setOrders(ordersData as Order[])

            // Calculate stats
            const pending = (ordersData as any[]).filter(o => ['pending', 'paid', 'confirmed'].includes(o.status)).length
            const delivered = (ordersData as any[]).filter(o => o.status === 'delivered').length
            const totalSpent = (ordersData as any[]).reduce((sum, o) => sum + o.total_amount, 0)

            setStats({
                totalOrders: ordersData.length,
                pendingOrders: pending,
                deliveredOrders: delivered,
                totalSpent
            })

            // Calculate Monthly Spending
            const monthlySpend = (ordersData as any[]).reduce((acc: any, order) => {
                const date = new Date(order.created_at)
                const month = date.toLocaleString('default', { month: 'short' })
                acc[month] = (acc[month] || 0) + order.total_amount
                return acc
            }, {})

            const chart = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => ({
                name: month,
                total: monthlySpend[month] || 0
            }))
            setChartData(chart)

            // Calculate "Buy Again" (Unique products from recent orders)
            const uniqueProducts = new Map()
            ordersData.forEach((order: any) => {
                if (order.product && !uniqueProducts.has(order.product.id)) {
                    uniqueProducts.set(order.product.id, order.product)
                }
            })
            setBuyAgainProducts(Array.from(uniqueProducts.values()).slice(0, 8))
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
        <div className="min-h-screen bg-gray-50 pb-safe">
            {/* Premium Header - Full Width */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 text-white pt-8 pb-16 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold mb-2">
                                Welcome, {user?.business_name || 'Retailer'}
                            </h1>
                            <p className="text-emerald-100/90 text-sm md:text-base">
                                Overview of your orders and activity
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                href="/retailer/profile"
                                className="flex-1 md:flex-none justify-center btn bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                            >
                                <UserIcon className="w-5 h-5" />
                                <span>Profile</span>
                            </Link>
                            <Link
                                href="/products"
                                className="flex-1 md:flex-none justify-center btn bg-emerald-500 text-white border-none hover:bg-emerald-400 px-6 py-2 rounded-lg font-medium shadow-lg shadow-emerald-900/20 transition-all"
                            >
                                Browse Products
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 -mt-8 pb-8 relative z-10 pointer-events-none">
                {/* Stats Cards - Overlapping Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8 pointer-events-auto">
                    <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100/50 backdrop-blur-xl">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.totalOrders}</div>
                                <div className="text-gray-500 text-xs md:text-sm font-medium">Total Orders</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100/50 backdrop-blur-xl">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                            </div>
                            <div>
                                <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.pendingOrders}</div>
                                <div className="text-gray-500 text-xs md:text-sm font-medium">Pending</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 md:p-6 shadow-md border border-gray-100/50 backdrop-blur-xl">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                            </div>
                            <div>
                                <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.deliveredOrders}</div>
                                <div className="text-gray-500 text-xs md:text-sm font-medium">Delivered</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-600 rounded-xl p-4 md:p-6 shadow-md shadow-emerald-900/10 text-white">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-white" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-2xl md:text-3xl font-bold truncate tracking-tight">{formatCurrency(stats.totalSpent)}</div>
                                <div className="text-emerald-100 text-xs md:text-sm font-medium">Total Spent</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytics & Actions Grid */}
                <div className="grid lg:grid-cols-3 gap-6 mb-8">
                    {/* Spending Chart */}
                    <div className="lg:col-span-2">
                        <SalesChart data={chartData} title="Monthly Spending" />
                    </div>

                    {/* Quick Reorder / Buy Again */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                        <h2 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                            <RefreshCcw className="w-5 h-5 text-emerald-600" />
                            Buy Again
                        </h2>
                        {buyAgainProducts.length > 0 ? (
                            <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-3">
                                {buyAgainProducts.map((product) => (
                                    <Link
                                        key={product.id}
                                        href={`/products/${product.id}`}
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                                            {product.images?.[0] && (
                                                <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                            <p className="text-xs text-emerald-600 font-medium">Reorder</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center py-8">
                                <ShoppingBag className="w-10 h-10 mb-2 opacity-50" />
                                <p className="text-sm">No recent items</p>
                            </div>
                        )}
                        <Link href="/products" className="mt-4 btn-secondary w-full justify-center text-sm">
                            Browse Catalog
                        </Link>
                    </div>
                </div>

                {/* Recent Orders Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="font-bold text-gray-900 text-lg">Recent Orders</h2>
                        <Link href="/retailer/orders" className="text-emerald-600 text-sm font-medium hover:text-emerald-700 hover:underline">
                            View All Orders
                        </Link>
                    </div>

                    {orders.length === 0 ? (
                        <div className="p-12 text-center">
                            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders placed yet</h3>
                            <p className="text-gray-500 mb-6 max-w-sm mx-auto">Start browsing our catalog to replenish your stock with the best products.</p>
                            <Link href="/products" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-emerald-600 hover:bg-emerald-700">
                                Browse Wholesale Products
                            </Link>
                        </div>
                    ) : (
                        <div>
                            {/* Mobile View: Cards */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {orders.slice(0, 5).map(order => (
                                    <div key={order.id} className="p-4 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                {order.order_number}
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusBadge(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200">
                                                {(order as any).product?.images?.[0] ? (
                                                    <img
                                                        src={(order as any).product.images[0]}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <Package className="w-8 h-8" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
                                                    {(order as any).product?.name}
                                                </h3>
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                                    <MapPin className="w-3 h-3" />
                                                    {(order as any).manufacturer?.business_name}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {order.quantity} units
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-1">
                                            <div>
                                                <div className="text-xs text-gray-500">Total Amount</div>
                                                <div className="text-lg font-bold text-gray-900">{formatCurrency(order.total_amount)}</div>
                                            </div>
                                            <Link
                                                href={`/retailer/orders/${order.id}`}
                                                className="flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors"
                                            >
                                                View Details
                                                <Eye className="w-4 h-4 ml-1" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop View: Table Rows */}
                            <div className="hidden md:block divide-y divide-gray-100">
                                {orders.slice(0, 5).map(order => (
                                    <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center gap-6">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200">
                                            {(order as any).product?.images?.[0] ? (
                                                <img
                                                    src={(order as any).product.images[0]}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Package className="w-8 h-8" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 grid grid-cols-12 gap-6 items-center">
                                            <div className="col-span-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                        {order.order_number}
                                                    </span>
                                                </div>
                                                <h3 className="font-medium text-gray-900 truncate">
                                                    {(order as any).product?.name}
                                                </h3>
                                            </div>

                                            <div className="col-span-3">
                                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                                    <MapPin className="w-4 h-4 text-gray-400" />
                                                    <span className="truncate">{(order as any).manufacturer?.business_name}</span>
                                                </div>
                                            </div>

                                            <div className="col-span-2">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </div>

                                            <div className="col-span-3 text-right">
                                                <div className="font-bold text-gray-900">
                                                    {formatCurrency(order.total_amount)}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {order.quantity} units
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    generateInvoice(order)
                                                }}
                                                className="p-2 hover:bg-gray-200 rounded-lg text-emerald-600 hover:text-emerald-700 transition-colors"
                                                title="Download Invoice"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                            <Link
                                                href={`/retailer/orders/${order.id}`}
                                                className="p-2 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
