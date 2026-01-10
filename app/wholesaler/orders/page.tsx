'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import Image from 'next/image'
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
    FileText,
    RefreshCw
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

    const createShipment = async (ordersInput: Order | Order[]) => {
        const ordersList = Array.isArray(ordersInput) ? ordersInput : [ordersInput]
        if (ordersList.length === 0) return

        const primaryOrder = ordersList[0]

        // Validation: Ensure manufacturer has pickup details
        const manuf = (primaryOrder as any).manufacturer
        if (!manuf?.address || !manuf?.phone || !manuf?.pincode || !manuf?.city) {
            toast.error('Please complete your Business Profile (Address/Phone) before shipping.')
            router.push('/wholesaler/profile')
            return
        }

        if (manuf.address.length < 10) {
            toast.error('Address is too short. Shiprocket requires at least 10 characters.')
            router.push('/wholesaler/profile')
            return
        }

        // Lock UI. Ideally locking all, but locking primary ID is enough to show spinner on one at least.
        setProcessingId(primaryOrder.id)

        try {
            const response = await fetch('/api/shiprocket/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderIds: ordersList.map(o => o.id)
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to create shipment')

            toast.success('Shipment created successfully!')
            fetchOrders()
            // Optionally auto-download manifest/label here?
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

    const syncOrder = async (orderId: string) => {
        setProcessingId(orderId)
        try {
            const toastId = toast.loading('Syncing with ShipRocket...')
            const response = await fetch('/api/shiprocket/sync-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            })

            const data = await response.json()
            toast.dismiss(toastId)

            if (!response.ok) throw new Error(data.error || 'Failed to sync')

            if (data.newStatus !== data.oldStatus) {
                toast.success(`Status updated: ${data.newStatus?.replace('_', ' ')}`)
                fetchOrders()
            } else {
                toast.success('Status up to date')
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

    // Calculate pending earnings
    const pendingEarnings = orders
        .filter(o => ['paid', 'confirmed', 'shipped', 'in_transit', 'out_for_delivery'].includes(o.status))
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
                        href="/wholesaler"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </Link>
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
                            <p className="text-gray-600">Manage and fulfill retail orders</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-right w-full md:w-auto">
                            <div className="text-sm text-emerald-600">Pending Earnings</div>
                            <div className="text-xl font-bold text-emerald-700">{formatCurrency(pendingEarnings)}</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    {['all', 'paid', 'confirmed', 'shipped', 'cancelled', 'in_transit', 'delivered'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === status
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                                }`}
                        >
                            {status === 'all' ? 'All Orders' : status === 'in_transit' ? 'In Transit' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Orders List */}
                {Object.keys(
                    filteredOrders.reduce((acc, order) => {
                        acc[order.order_number] = (acc[order.order_number] || []).concat(order)
                        return acc
                    }, {} as Record<string, Order[]>)
                ).length === 0 ? (
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
                    <div className="space-y-6">
                        {Object.entries(
                            filteredOrders.reduce((acc, order) => {
                                if (!acc[order.order_number]) acc[order.order_number] = []
                                acc[order.order_number].push(order)
                                return acc
                            }, {} as Record<string, Order[]>)
                        ).map(([orderNumber, group]) => {
                            const firstOrder = group[0]
                            const totalPayout = group.reduce((sum, o) => sum + o.manufacturer_payout, 0)
                            const totalPending = group.reduce((sum, o) => sum + (o.pending_amount || 0), 0)
                            const itemsReadyToShip = group.filter(o => o.status === 'paid')

                            // Determine overall status
                            const isAllDelivered = group.every(o => o.status === 'delivered')
                            const isAllShipped = group.every(o => o.status === 'shipped' || o.status === 'delivered')
                            // Fix: Include 'confirmed' items in the 'paid' check if we want them to count as paid, 
                            // BUT usually 'confirmed' > 'paid'. So let's add specific check.
                            const isAllConfirmed = group.every(o => ['confirmed', 'shipped', 'delivered'].includes(o.status))
                            const isAllPaid = group.every(o => ['paid', 'confirmed', 'shipped', 'delivered'].includes(o.status))

                            let overallStatus = 'pending'
                            if (group.every(o => o.status === 'cancelled')) overallStatus = 'cancelled'
                            else if (isAllDelivered) overallStatus = 'delivered'
                            else if (isAllShipped) overallStatus = 'shipped'
                            else if (isAllConfirmed) overallStatus = 'confirmed'
                            else if (isAllPaid) overallStatus = 'paid'
                            else if (group.some(o => o.status !== 'pending')) overallStatus = 'in_progress'

                            // Unified Tracking Logic
                            const unifiedAwb = group.every(o => o.awb_code && o.awb_code === firstOrder.awb_code) ? firstOrder.awb_code : null
                            const unifiedLabelUrl = group.every(o => o.shipping_label_url === firstOrder.shipping_label_url) ? firstOrder.shipping_label_url : null

                            return (
                                <div key={orderNumber} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 mb-6 transition-all hover:shadow-md">
                                    {/* Unified Order Header */}
                                    <div className="p-5 border-b border-gray-100 bg-white">
                                        <div className="flex flex-col md:flex-row justify-between gap-4">
                                            {/* Left: Order Info */}
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-lg font-bold text-gray-900 tracking-tight">
                                                        {orderNumber}
                                                    </span>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(overallStatus)}`}>
                                                        {overallStatus.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500 flex items-center gap-2">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {new Date(firstOrder.created_at).toLocaleDateString('en-IN', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                                <div className="mt-3 flex items-center gap-4 text-sm">
                                                    <div className="font-medium text-gray-900 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                                                        Payout: <span className="text-emerald-700 font-bold">{formatCurrency(totalPayout)}</span>
                                                    </div>
                                                    {totalPending > 0 && (
                                                        <div className="text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100 font-medium">
                                                            Pending COD: {formatCurrency(totalPending)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Retailer & Actions */}
                                            <div className="flex flex-col items-end gap-3">
                                                <div className="text-right text-sm text-gray-600">
                                                    <div className="font-medium text-gray-900 flex items-center justify-end gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                        {(firstOrder as any).retailer?.business_name}
                                                    </div>
                                                    <div className="text-xs mt-1">{(firstOrder as any).retailer?.city}, {(firstOrder as any).retailer?.state}</div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {/* Bulk Ship Button */}
                                                    {itemsReadyToShip.length > 0 && (
                                                        <button
                                                            onClick={() => createShipment(itemsReadyToShip)}
                                                            disabled={processingId === firstOrder.id}
                                                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            {processingId === firstOrder.id ? (
                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Truck className="w-4 h-4" />
                                                            )}
                                                            Ship {itemsReadyToShip.length} Items
                                                        </button>
                                                    )}

                                                    {/* Unified Tracking (Header Level) */}
                                                    {unifiedAwb && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => syncOrder(firstOrder.id)}
                                                                disabled={processingId === firstOrder.id}
                                                                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium flex items-center gap-1 hover:bg-gray-200 border border-gray-200"
                                                                title="Sync Status from ShipRocket"
                                                            >
                                                                <RefreshCw className={`w-4 h-4 ${processingId === firstOrder.id ? 'animate-spin' : ''}`} />
                                                            </button>
                                                            <a
                                                                href={`https://shiprocket.co/tracking/${unifiedAwb}`}
                                                                target="_blank"
                                                                className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium flex items-center gap-1 hover:bg-indigo-100 border border-indigo-100"
                                                            >
                                                                <Truck className="w-4 h-4" /> Track
                                                            </a>
                                                            {/* Label Download */}
                                                            <button
                                                                onClick={() => downloadLabel(firstOrder)}
                                                                className="bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
                                                            >
                                                                <Printer className="w-4 h-4" /> Label
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Table / List */}
                                    <div className="bg-gray-50/30">
                                        {group.map((order, index) => (
                                            <div key={order.id} className={`p-4 flex flex-col sm:flex-row gap-4 items-center ${index !== group.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                                {/* Image */}
                                                <div className="w-14 h-14 bg-white rounded-lg border border-gray-200 flex-shrink-0 relative overflow-hidden">
                                                    {(order as any).product?.images?.[0] ? (
                                                        <Image
                                                            src={(order as any).product.images[0]}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <Package className="w-5 h-5 text-gray-300 m-auto translate-y-4" />
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 text-center sm:text-left min-w-0">
                                                    <div className="font-medium text-gray-900 truncate">{(order as any).product?.name}</div>
                                                    <div className="text-xs text-gray-500 mt-1 flex items-center justify-center sm:justify-start gap-2">
                                                        <span>{order.quantity} units</span>
                                                        <span>×</span>
                                                        <span>{formatCurrency(order.unit_price)}</span>
                                                    </div>
                                                </div>

                                                {/* Status Badge (Item Level) */}
                                                <div className="flex-shrink-0">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(order.status).replace('bg-', 'bg-opacity-20 ')}`}>
                                                        {order.status.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                {/* Item Actions */}
                                                <div className="flex flex-wrap justify-center sm:justify-end gap-2 w-full sm:w-auto">
                                                    {order.status === 'pending' && (
                                                        <button
                                                            onClick={() => updateOrderStatus(order.id, 'paid')}
                                                            className="text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors font-medium shadow-sm"
                                                        >
                                                            Mark Paid
                                                        </button>
                                                    )}

                                                    {/* Individual Ship (Secondary Option) */}
                                                    {order.status === 'paid' && itemsReadyToShip.length > 1 && (
                                                        <button
                                                            onClick={() => createShipment(order)}
                                                            className="text-xs text-gray-400 hover:text-emerald-600 underline px-2 transition-colors"
                                                            title="Ship just this item"
                                                            disabled={processingId === order.id}
                                                        >
                                                            Ship Only This
                                                        </button>
                                                    )}

                                                    {/* Downloads / Tracking */}
                                                    {!unifiedAwb && order.shipping_label_url && (
                                                        <button
                                                            onClick={() => window.open(order.shipping_label_url, '_blank')}
                                                            className="text-gray-500 hover:text-gray-700 bg-white border border-gray-200 p-1.5 rounded shadow-sm"
                                                            title="Download Label"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {!unifiedAwb && order.awb_code && (
                                                        <a
                                                            href={`https://shiprocket.co/tracking/${order.awb_code}`}
                                                            target="_blank"
                                                            className="px-3 py-1.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                                                        >
                                                            <Truck className="w-3 h-3" /> Track
                                                        </a>
                                                    )}

                                                    {/* Details Link */}
                                                    <Link
                                                        href={`/wholesaler/orders/${order.id}`}
                                                        className="text-gray-400 hover:text-gray-600 p-1.5"
                                                    >
                                                        <ArrowLeft className="w-4 h-4 rotate-180" />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer Optional info */}
                                    <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                        <div>
                                            {group.length} Product{group.length > 1 ? 's' : ''}
                                        </div>
                                        <div className="flex gap-4">
                                            <span>Pay: {group[0].payment_type === 'advance' ? 'COD (Shipping Paid)' : 'Full'}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
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
