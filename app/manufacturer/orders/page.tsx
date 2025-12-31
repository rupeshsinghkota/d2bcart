'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
    ArrowLeft,
    Package,
    Clock,
    CheckCircle,
    Truck,
    Phone,
    MapPin,
    Printer,
    FileText
} from 'lucide-react'

const OrdersContent = () => {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>(searchParams.get('status') || 'all')
    const [processingId, setProcessingId] = useState<string | null>(null)

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
        product:products(name, images),
        retailer:users!orders_retailer_id_fkey(business_name, city, phone, address, state, pincode),
        manufacturer:users!orders_manufacturer_id_fkey(address, phone, pincode, city)
      `)
            .eq('manufacturer_id', user.id)
            .order('created_at', { ascending: false })

        if (data) setOrders(data as Order[])
        setLoading(false)
    }

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        const updates: any = { status: newStatus }

        if (newStatus === 'shipped') {
            updates.shipped_at = new Date().toISOString()
        } else if (newStatus === 'delivered') {
            updates.delivered_at = new Date().toISOString()
        }

        const { error } = await (supabase
            .from('orders') as any)
            .update(updates)
            .eq('id', orderId)

        if (error) {
            toast.error('Failed to update order')
        } else {
            toast.success(`Order marked as ${newStatus}`)
            fetchOrders()
        }
    }

    const createShipment = async (order: Order) => {
        // Validation: Ensure manufacturer has pickup details
        const manuf = (order as any).manufacturer
        if (!manuf?.address || !manuf?.phone || !manuf?.pincode || !manuf?.city) {
            toast.error('Please complete your Business Profile (Address/Phone) before shipping.')
            router.push('/manufacturer/profile')
            return
        }

        if (manuf.address.length < 10) {
            toast.error('Address is too short. Shiprocket requires at least 10 characters.')
            router.push('/manufacturer/profile')
            return
        }

        setProcessingId(order.id)
        try {
            const response = await fetch('/api/shiprocket/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to create shipment')

            toast.success('Shipment created successfully!')
            fetchOrders()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setProcessingId(null)
        }
    }

    const downloadLabel = async (order: Order) => {
        if (order.shipping_label_url) {
            window.open(order.shipping_label_url, '_blank')
            return
        }

        if (!order.shipment_id) {
            toast.error('No shipment ID found')
            return
        }

        setProcessingId(order.id)
        try {
            // If URL not saved to DB yet, try to fetch it
            const response = await fetch('/api/shiprocket/generate-label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shipmentId: order.shipment_id,
                    orderId: order.id
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to generate label')

            if (data.label_url) {
                window.open(data.label_url, '_blank')
                // Update local state to include label URL so we don't fetch again if they click immediately
                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, shipping_label_url: data.label_url } : o))
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setProcessingId(null)
        }
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-gray-100 text-gray-700',
            paid: 'bg-yellow-100 text-yellow-700',
            confirmed: 'bg-blue-100 text-blue-700', // When confirmed by platform/shiprocket
            shipped: 'bg-purple-100 text-purple-700',
            delivered: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700'
        }
        return styles[status] || 'bg-gray-100 text-gray-700'
    }

    const filteredOrders = filter === 'all'
        ? orders
        : orders.filter(o => o.status === filter)

    // Calculate pending earnings
    const pendingEarnings = orders
        .filter(o => ['paid', 'confirmed', 'shipped'].includes(o.status))
        .reduce((sum, o) => sum + o.manufacturer_payout, 0)

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
                        href="/manufacturer"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </Link>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
                            <p className="text-gray-600">Manage and fulfill retail orders</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-right">
                            <div className="text-sm text-emerald-600">Pending Earnings</div>
                            <div className="text-xl font-bold text-emerald-700">{formatCurrency(pendingEarnings)}</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {['all', 'paid', 'confirmed', 'shipped', 'delivered'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === status
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {status === 'all' ? 'All Orders' : status.charAt(0).toUpperCase() + status.slice(1)}
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
                        <p className="text-gray-500">
                            {filter === 'all'
                                ? "You haven't received any orders yet"
                                : `No ${filter} orders`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                {/* Order Header */}
                                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                    <div>
                                        <span className="font-mono text-sm font-medium">
                                            {order.order_number}
                                        </span>
                                        <span className="text-gray-400 mx-2">•</span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString('en-IN')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {order.awb_code && (
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                AWB: {order.awb_code}
                                            </span>
                                        )}
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Order Content */}
                                <div className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
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

                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">
                                                {(order as any).product?.name}
                                            </h3>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {order.quantity} units × {formatCurrency(order.unit_price)}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-sm text-gray-500">You'll receive</div>
                                            <div className="text-xl font-bold text-emerald-600">
                                                {formatCurrency(order.manufacturer_payout)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Retailer Info */}
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                        <div className="text-sm font-medium text-gray-700 mb-2">Ship To:</div>
                                        <div className="text-sm text-gray-600">
                                            <div className="font-medium">{(order as any).retailer?.business_name}</div>
                                            <div className="mt-1 text-gray-700">
                                                {order.shipping_address || (order as any).retailer?.address}
                                            </div>
                                            <div className="flex items-center gap-1 mt-1 text-gray-500">
                                                <MapPin className="w-3 h-3" />
                                                {(order as any).retailer?.city}
                                                {(order as any).retailer?.state ? `, ${(order as any).retailer.state}` : ''}
                                                {(order as any).retailer?.pincode ? ` - ${(order as any).retailer.pincode}` : ''}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-4 flex flex-wrap gap-2">

                                        {/* Status: Pending -> Paid (Manual) */}
                                        {order.status === 'pending' && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'paid')}
                                                className="btn-outline !py-2 !px-4 text-sm flex items-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Mark as Paid (Manual)
                                            </button>
                                        )}

                                        {/* Status: Paid -> Confirmed (Create Shipment) */}
                                        {order.status === 'paid' && (
                                            <button
                                                onClick={() => createShipment(order)}
                                                disabled={processingId === order.id}
                                                className="btn-primary !py-2 !px-4 text-sm flex items-center gap-2"
                                            >
                                                {processingId === order.id ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Truck className="w-4 h-4" />
                                                )}
                                                Ship & Request Pickup
                                            </button>
                                        )}

                                        {/* Status: Confirmed -> Download Label  + Mark Shipped */}
                                        {['confirmed', 'shipped'].includes(order.status) && (
                                            <>
                                                {order.shipment_id && (
                                                    <button
                                                        onClick={() => downloadLabel(order)}
                                                        disabled={processingId === order.id}
                                                        className="btn-outline !py-2 !px-4 text-sm flex items-center gap-2"
                                                    >
                                                        {processingId === order.id ? (
                                                            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Printer className="w-4 h-4" />
                                                        )}
                                                        Download Label
                                                    </button>
                                                )}

                                                {order.status === 'confirmed' && (
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, 'shipped')}
                                                        className="btn-primary !py-2 !px-4 text-sm flex items-center gap-2"
                                                    >
                                                        <Truck className="w-4 h-4" />
                                                        Mark as Shipped
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* Status: Shipped -> Delivered */}
                                        {['shipped', 'delivered'].includes(order.status) && order.awb_code && (
                                            <a
                                                href={`https://shiprocket.co/tracking/${order.awb_code}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-outline !py-2 !px-4 text-sm flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                                            >
                                                <Truck className="w-4 h-4" />
                                                Track
                                            </a>
                                        )}

                                        {/* Link to Details Page */}
                                        <Link
                                            href={`/manufacturer/orders/${order.id}`}
                                            className="ml-auto text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                        >
                                            View Details
                                            <ArrowLeft className="w-4 h-4 rotate-180" />
                                        </Link>
                                        {order.status === 'shipped' && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'delivered')}
                                                className="btn-primary !py-2 !px-4 text-sm flex items-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Mark as Delivered
                                            </button>
                                        )}

                                        {/* Status: Delivered */}
                                        {order.status === 'delivered' && (
                                            <div className="text-sm text-green-600 flex items-center gap-1">
                                                <CheckCircle className="w-4 h-4" />
                                                Completed
                                            </div>
                                        )}
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

export default function ManufacturerOrdersPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading orders...</div>}>
            <OrdersContent />
        </Suspense>
    )
}
