'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import {
    ArrowLeft,
    Package,
    Truck,
    MapPin,
    Calendar
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Order } from '@/types'
import { generateInvoice } from '@/lib/invoice-generator'

export default function RetailerOrderDetails() {
    const params = useParams()
    const [mainOrder, setMainOrder] = useState<Order | null>(null)
    const [groupItems, setGroupItems] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchOrderGroup()
    }, [])

    const fetchOrderGroup = async () => {
        // 1. Fetch the specific order item to get the Order Number
        const { data: initialOrder, error } = await supabase
            .from('orders')
            .select('order_number')
            .eq('id', params.id as string)
            .single() as { data: { order_number: string } | null, error: any }

        if (!initialOrder || error) {
            setLoading(false)
            return
        }

        // 2. Fetch ALL items with this Order Number
        const { data: allItems } = await supabase
            .from('orders')
            .select(`
                *,
                product:products(name, images, base_price),
                manufacturer:users!orders_manufacturer_id_fkey(business_name, email, phone, address, city, state, pincode),
                retailer:users!orders_retailer_id_fkey(business_name, city, phone, email, address, state, pincode)
            `)
            .eq('order_number', initialOrder.order_number) as { data: Order[] | null }

        if (allItems && allItems.length > 0) {
            setMainOrder(allItems[0] as Order) // Use first item for header info
            setGroupItems(allItems as Order[])

            // Auto-track if AWB exists on the first item (Group usually shares AWB)
            // Note: If different items have different AWBs, this logic might need loop.
            // For now assuming 1 Shipment = 1 AWB per Order Group.
            const data = allItems[0]
            const finalStates = ['delivered', 'cancelled', 'rto_delivered']
            if (data.awb_code && !finalStates.includes(data.status)) {
                fetch('/api/shiprocket/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: data.id })
                }).then(res => res.json()).then(trackRes => {
                    if (trackRes.updated) {
                        // Refresh not strictly needed if only status updated, but good for sync
                    }
                }).catch(err => console.error('Auto-track error', err))
            }
        }
        setLoading(false)
    }

    if (loading) return <div className="p-8 text-center min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>

    if (!mainOrder) return <div className="p-8 text-center">Order not found</div>

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            pending: 'bg-gray-100 text-gray-700',
            paid: 'bg-yellow-100 text-yellow-800',
            confirmed: 'bg-blue-100 text-blue-800',
            shipped: 'bg-purple-100 text-purple-800',
            in_transit: 'bg-indigo-100 text-indigo-800',
            out_for_delivery: 'bg-emerald-100 text-emerald-800',
            delivered: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800',
            rto_initiated: 'bg-orange-100 text-orange-800',
            rto_delivered: 'bg-red-100 text-red-800'
        }
        return colors[status] || 'bg-gray-100 text-gray-800'
    }

    const grandTotal = groupItems.reduce((sum, item) => sum + item.total_amount, 0)
    const totalPending = groupItems.reduce((sum, item) => sum + (item.pending_amount || 0), 0)

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-20 md:pb-8">
            <div className="max-w-4xl mx-auto">
                <Link href="/retailer/orders" className="flex items-center text-gray-500 hover:text-gray-900 mb-6 w-fit">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Orders
                </Link>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 md:p-6 border-b bg-gray-50 flex flex-col md:flex-row justify-between items-start gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Order #{mainOrder.order_number}</h1>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(mainOrder.status)}`}>
                                    {mainOrder.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {formatDate(mainOrder.created_at)}
                                </span>
                                <span>
                                    {groupItems.length} Items
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            {mainOrder.awb_code && (
                                <a
                                    href={`https://shiprocket.co/tracking/${mainOrder.awb_code}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 flex-1 md:flex-none text-sm transition-colors"
                                >
                                    <Truck className="w-4 h-4" />
                                    Track Shipment
                                </a>
                            )}

                            <button
                                onClick={() => generateInvoice(groupItems)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 flex-1 md:flex-none text-sm transition-colors"
                            >
                                <Package className="w-4 h-4" />
                                Download Invoice
                            </button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 md:gap-8 p-4 md:p-8">
                        {/* Product List (Grouped) */}
                        <div className="md:col-span-2 space-y-6">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="w-5 h-5 text-gray-400" />
                                Items Ordered
                            </h2>

                            <div className="space-y-3">
                                {groupItems.map((item, idx) => (
                                    <div key={item.id || idx} className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex gap-4">
                                            <div className="w-20 h-20 bg-white rounded-md flex-shrink-0 overflow-hidden border relative">
                                                {(item as any).product?.images?.[0] && (
                                                    <Image src={(item as any).product.images[0]} alt="" fill className="object-cover" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium text-gray-900 line-clamp-2">{(item as any).product?.name}</h3>
                                                <div className="text-sm text-gray-500 mt-1">
                                                    Qty: <span className="font-semibold text-gray-900">{item.quantity}</span>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    ₹{item.unit_price} / unit
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 mt-2 sm:mt-0 sm:ml-auto text-left sm:text-right flex flex-row sm:flex-col justify-between sm:items-end gap-1">
                                            <div className="block sm:hidden text-sm text-gray-500">Total</div>
                                            <div className="font-bold text-gray-900">
                                                {formatCurrency(item.total_amount)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Group Summary */}
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="text-sm text-emerald-800">
                                    Total for {groupItems.length} items
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-emerald-900">{formatCurrency(grandTotal)}</div>
                                    {totalPending > 0 ? (
                                        <div className="text-sm font-medium text-amber-600">
                                            Pending (COD): {formatCurrency(totalPending)}
                                        </div>
                                    ) : (
                                        <div className="text-sm font-medium text-green-600">
                                            Fully Paid
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Wholesaler / Shipping From */}
                        <div className="space-y-6">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-gray-400" />
                                Sold By
                            </h2>
                            <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2 border border-gray-100">
                                <div className="font-medium text-gray-900">{mainOrder.manufacturer?.business_name}</div>
                                <div className="text-gray-600">
                                    {mainOrder.manufacturer?.city}, {mainOrder.manufacturer?.state}
                                </div>
                                <div className="text-gray-600">
                                    {mainOrder.manufacturer?.address}
                                </div>
                                <div className="pt-2 border-t border-gray-200 mt-2">
                                    <div className="flex items-center gap-2 text-gray-600 truncate">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 shrink-0">EMAIL</span>
                                        <span className="truncate">{mainOrder.manufacturer?.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600 truncate mt-1">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 shrink-0">PHONE</span>
                                        <span className="truncate">{mainOrder.manufacturer?.phone}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
