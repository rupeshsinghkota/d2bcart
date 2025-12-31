'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
    ArrowLeft,
    Package,
    Clock,
    CheckCircle,
    Truck,
    Filter,
    FileText,
    RefreshCw,
    MapPin
} from 'lucide-react'
import { generateInvoice } from '@/lib/invoice-generator'
import { useStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

export default function RetailerOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const addItems = useStore((state) => state.addItems)
    const router = useRouter()

    const handleBuyAgain = (order: Order) => {
        const product = (order as any).product
        if (!product) return

        addItems([{
            product: product,
            quantity: order.quantity
        }])

        toast.success('Added to cart')
        router.push('/cart')
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        if (!isSupabaseConfigured) {
            setLoading(false)
            return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from('orders')
            .select(`
        *,
        product:products(id, name, images, display_price, base_price, manufacturer_id, category:categories(name)),
        manufacturer:users!orders_manufacturer_id_fkey(business_name, city, phone)
      `)
            .eq('retailer_id', user.id)
            .order('created_at', { ascending: false })

        if (data) setOrders(data as Order[])
        setLoading(false)
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
            case 'paid':
                return <Clock className="w-5 h-5 text-yellow-600" />
            case 'confirmed':
                return <CheckCircle className="w-5 h-5 text-blue-600" />
            case 'shipped':
                return <Truck className="w-5 h-5 text-purple-600" />
            case 'delivered':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            default:
                return <Package className="w-5 h-5 text-gray-400" />
        }
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

    const filteredOrders = filter === 'all'
        ? orders
        : orders.filter(o => o.status === filter)

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/retailer"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
                    <p className="text-gray-600">Track all your orders from manufacturers</p>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {['all', 'pending', 'paid', 'confirmed', 'shipped', 'delivered'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === status
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                            {status === 'all' && ` (${orders.length})`}
                        </button>
                    ))}
                </div>

                {/* Orders List */}
                {filteredOrders.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-600 mb-2">
                            No orders found
                        </h2>
                        <p className="text-gray-500 mb-6">
                            {filter === 'all'
                                ? "You haven't placed any orders yet"
                                : `No ${filter} orders`}
                        </p>
                        <Link href="/products" className="btn-primary inline-block">
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                {/* Order Header */}
                                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {getStatusIcon(order.status)}
                                        <div>
                                            <span className="font-mono text-sm font-medium">
                                                {order.order_number}
                                            </span>
                                            <span className="text-gray-400 mx-2">•</span>
                                            <span className="text-sm text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(order.status)}`}>
                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    </span>
                                </div>

                                {/* Order Content */}
                                <div className="p-4 flex items-center gap-4">
                                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                                        {(order as any).product?.images?.[0] ? (
                                            <img
                                                src={(order as any).product.images[0]}
                                                alt=""
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        ) : (
                                            <Package className="w-8 h-8 text-gray-400" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900">
                                            {(order as any).product?.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {(order as any).product?.category?.name}
                                        </p>
                                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                                            <MapPin className="w-3 h-3" />
                                            {(order as any).manufacturer?.business_name}, {(order as any).manufacturer?.city}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-lg font-bold text-gray-900">
                                            {formatCurrency(order.total_amount)}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {order.quantity} units × {formatCurrency(order.unit_price)}
                                        </div>
                                    </div>
                                </div>

                                {/* Order Actions */}
                                <div className="px-4 pb-4 flex items-center justify-end gap-3 border-t bg-gray-50/50 pt-3 mt-4">
                                    {(['paid', 'confirmed', 'shipped', 'delivered'].includes(order.status)) && (
                                        <>
                                            <button
                                                onClick={() => handleBuyAgain(order)}
                                                className="text-sm font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                                Buy Again
                                            </button>
                                            <button
                                                onClick={() => generateInvoice(order)}
                                                className="text-sm font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                                            >
                                                <FileText className="w-4 h-4" />
                                                Invoice
                                            </button>
                                        </>
                                    )}

                                    {order.status === 'shipped' && order.tracking_number && (
                                        <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                            <Truck className="w-4 h-4" />
                                            Track: {order.tracking_number}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
