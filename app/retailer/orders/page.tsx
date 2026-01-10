'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Order } from '@/types'
import Image from 'next/image'
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
        manufacturer:users!orders_manufacturer_id_fkey(business_name, city, phone, email, address, state, pincode),
        retailer:users!orders_retailer_id_fkey(business_name, city, phone, email, address, state, pincode)
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
            case 'in_transit':
                return <Truck className="w-5 h-5 text-purple-600" />
            case 'out_for_delivery':
                return <Truck className="w-5 h-5 text-indigo-600" />
            case 'delivered':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            case 'rto_initiated':
            case 'rto_delivered':
                return <RefreshCw className="w-5 h-5 text-orange-600" />
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
            in_transit: 'bg-indigo-100 text-indigo-700',
            out_for_delivery: 'bg-emerald-100 text-emerald-700',
            delivered: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700',
            rto_initiated: 'bg-orange-100 text-orange-700',
            rto_delivered: 'bg-red-100 text-red-700'
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
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    {['all', 'pending', 'paid', 'confirmed', 'shipped', 'in_transit', 'delivered'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === status
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                                }`}
                        >
                            {status === 'in_transit' ? 'In Transit' : status.charAt(0).toUpperCase() + status.slice(1)}
                            {status === 'all' && ` (${orders.length})`}
                        </button>
                    ))}
                </div>

                {/* Orders Grid (Responsive) */}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col hover:border-emerald-200 transition-colors">
                                {/* Order Header */}
                                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(order.status)}
                                        <div>
                                            <span className="font-mono text-xs font-medium text-gray-900 block">
                                                #{order.order_number}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${getStatusBadge(order.status)}`}>
                                        {order.status}
                                    </span>
                                </div>

                                {/* Order Content */}
                                <div className="p-4 flex gap-4 flex-1">
                                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 relative">
                                        {(order as any).product?.images?.[0] ? (
                                            <Image
                                                src={(order as any).product.images[0]}
                                                alt=""
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <Package className="w-8 h-8 text-gray-400" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col">
                                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1" title={(order as any).product?.name}>
                                            {(order as any).product?.name}
                                        </h3>

                                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-auto">
                                            <MapPin className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{(order as any).manufacturer?.business_name}</span>
                                        </div>

                                        <div className="mt-3 flex items-end justify-between">
                                            <div>
                                                <div className="text-xs text-gray-500 mb-0.5">{order.quantity} units</div>
                                                <div className="text-sm font-bold text-gray-900">
                                                    {formatCurrency(order.total_amount)}
                                                </div>
                                            </div>

                                            {(order.pending_amount || 0) > 0 ? (
                                                <div className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                    Due: {formatCurrency(order.pending_amount || 0)}
                                                </div>
                                            ) : (
                                                <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                                                    Paid
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="p-3 border-t bg-gray-50/50 flex items-center justify-between gap-2">
                                    <Link
                                        href={`/retailer/orders/${order.id}`}
                                        className="text-xs font-medium text-gray-600 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                                    >
                                        View Details
                                    </Link>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => generateInvoice(order)}
                                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                            title="Invoice"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleBuyAgain(order)}
                                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Reorder
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
