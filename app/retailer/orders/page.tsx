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
                        <div className="space-y-4">
                            {/* Mobile: Cards */}
                            <div className="md:hidden space-y-4">
                                {filteredOrders.map(order => (
                                    <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                                        {/* Order Header */}
                                        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {getStatusIcon(order.status)}
                                                <div>
                                                    <span className="font-mono text-xs font-medium text-gray-900">
                                                        #{order.order_number}
                                                    </span>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(order.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${getStatusBadge(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>

                                        {/* Order Content */}
                                        <div className="p-4 flex gap-4">
                                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 relative">
                                                {(order as any).product?.images?.[0] ? (
                                                    <Image
                                                        src={(order as any).product.images[0]}
                                                        alt=""
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <Package className="w-6 h-6 text-gray-400" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                                                    {(order as any).product?.name}
                                                </h3>
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {(order as any).manufacturer?.business_name}
                                                </div>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900">
                                                            {formatCurrency(order.total_amount)}
                                                        </div>
                                                        {(order.pending_amount || 0) > 0 && (
                                                            <div className="text-xs font-medium text-amber-600">
                                                                Pay on Delivery: {formatCurrency(order.pending_amount || 0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-right">
                                                        <div className="text-gray-500">{order.quantity} units</div>
                                                        <div className={`mt-1 font-medium px-1.5 py-0.5 rounded text-[10px] inline-block ${order.payment_type === 'advance' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                                            }`}>
                                                            {order.payment_type === 'advance' ? '20% Adv' : 'Full Pay'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="px-4 pb-4 flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleBuyAgain(order)}
                                                className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                                                title="Buy Again"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => generateInvoice(order)}
                                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"
                                                title="Invoice"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                            <Link
                                                href={`/retailer/orders/${order.id}`}
                                                className="p-2 bg-gray-100 text-gray-600 rounded-lg"
                                            >
                                                <ArrowLeft className="w-4 h-4 rotate-180" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop: Table */}
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Manufacturer</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Payment</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredOrders.map(order => (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        {getStatusIcon(order.status)}
                                                        <div>
                                                            <div className="font-mono text-sm font-medium text-gray-900">{order.order_number}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {new Date(order.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200 relative">
                                                            {(order as any).product?.images?.[0] && (
                                                                <Image src={(order as any).product.images[0]} alt="" fill className="object-cover" />
                                                            )}
                                                        </div>
                                                        <div className="max-w-[200px]">
                                                            <div className="text-sm font-medium text-gray-900 truncate">{(order as any).product?.name}</div>
                                                            <div className="text-xs text-gray-500">{order.quantity} units</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="truncate max-w-[150px]">{(order as any).manufacturer?.business_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(order.status)}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <div className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount)}</div>
                                                        {(order.pending_amount || 0) > 0 ? (
                                                            <div className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                                Due: {formatCurrency(order.pending_amount || 0)}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">Fully Paid</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleBuyAgain(order)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                            title="Buy Again"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => generateInvoice(order)}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                                            title="Invoice"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                        <Link
                                                            href={`/retailer/orders/${order.id}`}
                                                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                                            title="View Details"
                                                        >
                                                            <ArrowLeft className="w-4 h-4 rotate-180" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
