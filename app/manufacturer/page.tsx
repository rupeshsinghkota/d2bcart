'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Product, Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
    Package,
    ShoppingBag,
    TrendingUp,
    Plus,
    Eye,
    Edit,
    MoreVertical,
    Clock,
    CheckCircle,
    Truck,
    Building2,
    Upload
} from 'lucide-react'
import Image from 'next/image'
import { SalesChart } from '@/components/analytics/SalesChart'
import { TopProducts } from '@/components/analytics/TopProducts'

export default function ManufacturerDashboard() {
    const [products, setProducts] = useState<Product[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalOrders: 0,
        totalEarnings: 0,
        pendingOrders: 0
    })
    const [loading, setLoading] = useState(true)
    const [isVerified, setIsVerified] = useState(true)
    const [productFilter, setProductFilter] = useState('all')

    const filteredProducts = productFilter === 'low_stock'
        ? products.filter(p => p.stock < 10)
        : products

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Check verification - First get the user profile to check verification status
        const { data: profile } = await supabase
            .from('users')
            .select('is_verified')
            .eq('id', user.id)
            .single() as { data: { is_verified: boolean } | null, error: any }

        if (profile) setIsVerified(profile.is_verified)

        // Fetch products
        const { data: productsData } = await supabase
            .from('products')
            .select('*, category:categories(name)')
            .eq('manufacturer_id', user.id)
            .order('created_at', { ascending: false })

        if (productsData) setProducts(productsData as Product[])

        // Fetch orders
        const { data: ordersData } = await supabase
            .from('orders')
            .select(`
        *,
        product:products(name),
        retailer:users!orders_retailer_id_fkey(business_name, city)
      `)
            .eq('manufacturer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)

        if (ordersData) setOrders(ordersData as Order[])

        const typedOrders = (ordersData || []) as Order[]

        const totalEarnings = typedOrders.reduce((sum, o) =>
            ['delivered', 'shipped'].includes(o.status) ? sum + o.manufacturer_payout : sum, 0
        )

        const pendingOrders = typedOrders.filter(o =>
            ['paid', 'confirmed'].includes(o.status)
        ).length

        // Calculate monthly revenue
        const monthlyRevenue = typedOrders.reduce((acc: any, order) => {
            if (!['paid', 'confirmed', 'shipped', 'delivered'].includes(order.status)) return acc

            const date = new Date(order.created_at)
            const month = date.toLocaleString('default', { month: 'short' })

            acc[month] = (acc[month] || 0) + order.manufacturer_payout
            return acc
        }, {})

        const chartData = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ].map(month => ({
            name: month,
            total: monthlyRevenue[month] || 0
        }))

        // Calculate top products
        const productsMap = new Map()
        typedOrders.forEach(order => {
            if (!['paid', 'confirmed', 'shipped', 'delivered'].includes(order.status)) return

            const current = productsMap.get(order.product_id) || {
                name: order.product?.name || 'Unknown',
                sales: 0,
                revenue: 0,
                image: order.product?.images?.[0]
            }

            current.sales += order.quantity
            current.revenue += order.manufacturer_payout
            productsMap.set(order.product_id, current)
        })

        const topProducts = Array.from(productsMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)

        setStats({
            totalProducts: productsData?.length || 0,
            totalOrders: ordersData?.length || 0,
            totalEarnings,
            pendingOrders,
            chartData,
            topProducts
        } as any)

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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Manufacturer Dashboard</h1>
                        <p className="text-gray-600">Manage your products and orders</p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <Link
                            href="/manufacturer/profile"
                            className="btn-secondary flex-1 md:flex-none justify-center flex items-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                        >
                            <Building2 className="w-5 h-5" />
                            Profile
                        </Link>
                        <Link
                            href="/manufacturer/products/bulk"
                            className="btn-secondary flex-1 md:flex-none justify-center flex items-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                        >
                            <Upload className="w-5 h-5" />
                            Bulk
                        </Link>
                        <Link
                            href="/manufacturer/products/new"
                            className="btn-primary flex-1 md:flex-none justify-center flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Add Product
                        </Link>
                    </div>
                </div>

                {!isVerified && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 flex items-start gap-4">
                        <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                            <Building2 className="w-6 h-6 text-yellow-700" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-yellow-900">Account Pending Verification</h3>
                            <p className="text-yellow-700 mt-1">
                                Your products will not be visible to retailers until your business details and ID proof are verified by our team.
                            </p>
                        </div>
                        <Link
                            href="/manufacturer/profile"
                            className="btn-primary bg-yellow-600 hover:bg-yellow-700 border-yellow-600 text-white whitespace-nowrap"
                        >
                            Complete Profile
                        </Link>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Link href="/manufacturer/products" className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                                <div className="text-gray-500 text-sm">Products</div>
                            </div>
                        </div>
                    </Link>

                    <Link href="/manufacturer/orders" className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <ShoppingBag className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                                <div className="text-gray-500 text-sm">Orders</div>
                            </div>
                        </div>
                    </Link>

                    <Link href="/manufacturer/orders?status=pending" className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <Clock className="w-6 h-6 text-yellow-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{stats.pendingOrders}</div>
                                <div className="text-gray-500 text-sm">Pending</div>
                            </div>
                        </div>
                    </Link>

                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 shadow-sm text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{formatCurrency(stats.totalEarnings)}</div>
                                <div className="text-emerald-100 text-sm">Earnings</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytics Section */}
                <div className="grid lg:grid-cols-2 gap-8 mb-8">
                    <SalesChart data={(stats as any).chartData || []} />
                    <TopProducts products={(stats as any).topProducts || []} />
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Products List */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm">
                            <div className="p-6 border-b flex justify-between items-center">
                                <h2 className="font-semibold text-lg">My Products</h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setProductFilter(productFilter === 'low_stock' ? 'all' : 'low_stock')}
                                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${productFilter === 'low_stock'
                                            ? 'bg-red-100 text-red-700 ring-2 ring-red-500 ring-offset-2'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        Low Stock
                                    </button>
                                    <Link href="/manufacturer/products" className="text-emerald-600 text-sm hover:underline flex items-center">
                                        View All
                                    </Link>
                                </div>
                            </div>

                            {products.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500 mb-4">No products yet</p>
                                    <Link href="/manufacturer/products/new" className="text-emerald-600 hover:underline">
                                        Add your first product
                                    </Link>
                                </div>
                            ) : (
                                <div className="divide-y max-h-[400px] overflow-y-auto">
                                    {filteredProducts.slice(0, 10).map(product => (
                                        <div key={product.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                                                {product.images?.[0] ? (
                                                    <Image src={product.images[0]} alt="" fill className="object-cover rounded-lg" />
                                                ) : (
                                                    <Package className="w-6 h-6 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-sm text-gray-500">Stock: {product.stock}</span>
                                                    {product.stock < 10 && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-100 text-red-700">
                                                            Low Stock
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-sm">
                                                    <span className="text-emerald-600 font-semibold">
                                                        {formatCurrency(product.base_price)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-full text-xs ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {product.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <Link
                                                    href={`/manufacturer/products/${product.id}/edit`}
                                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                                >
                                                    <Edit className="w-4 h-4 text-gray-400" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Orders */}
                    <div>
                        <div className="bg-white rounded-xl shadow-sm">
                            <div className="p-6 border-b flex justify-between items-center">
                                <h2 className="font-semibold text-lg">Recent Orders</h2>
                                <Link href="/manufacturer/orders" className="text-emerald-600 text-sm hover:underline">
                                    View All
                                </Link>
                            </div>

                            {orders.length === 0 ? (
                                <div className="p-12 text-center">
                                    <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">No orders yet</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {orders.slice(0, 5).map(order => (
                                        <Link
                                            key={order.id}
                                            href={`/manufacturer/orders/${order.id}`}
                                            className="block p-4 hover:bg-gray-50"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono text-sm text-gray-500">
                                                    {order.order_number}
                                                </span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-900 mb-1">
                                                {order.product?.name}
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">
                                                    {order.quantity} units
                                                </span>
                                                <span className="font-semibold text-emerald-600">
                                                    {formatCurrency(order.manufacturer_payout)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {order.retailer?.business_name}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
