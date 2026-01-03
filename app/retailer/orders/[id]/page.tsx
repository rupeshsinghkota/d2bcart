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
    Calendar,
    ExternalLink
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Order } from '@/types'
import { generateInvoice } from '@/lib/invoice-generator'

export default function RetailerOrderDetails() {
    const params = useParams()
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchOrder()
    }, [])

    const fetchOrder = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                product:products(name, images, base_price),
                manufacturer:users!orders_manufacturer_id_fkey(business_name, email, phone, address, city, state, pincode),
                retailer:users!orders_retailer_id_fkey(business_name, city, phone, email, address, state, pincode)
            `)
            .eq('id', params.id as string)
            .single() as { data: Order | null, error: any }

        if (data) {
            setOrder(data)

            // Auto-track if AWB exists and not in a final state
            const finalStates = ['delivered', 'cancelled', 'rto_delivered']
            if (data.awb_code && !finalStates.includes(data.status)) {
                fetch('/api/shiprocket/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: data.id })
                }).then(res => res.json()).then(trackRes => {
                    if (trackRes.updated) {
                        fetchOrder()
                    }
                }).catch(err => console.error('Auto-track error', err))
            }
        }
        setLoading(false)
    }

    if (loading) return <div className="p-8 text-center">Loading...</div>
    if (!order) return <div className="p-8 text-center">Order not found</div>

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

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <Link href="/retailer/orders" className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Orders
                </Link>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b bg-gray-50 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold text-gray-900">Order #{order.order_number}</h1>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                                    {order.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {formatDate(order.created_at)}
                                </span>
                            </div>
                        </div>

                        {order.awb_code && (
                            <a
                                href={`https://shiprocket.co/tracking/${order.awb_code}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                            >
                                <Truck className="w-4 h-4" />
                                Track Shipment
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}

                        <button
                            onClick={() => generateInvoice(order)}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                        >
                            <Package className="w-4 h-4" />
                            Download Invoice
                        </button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 p-8">
                        {/* Product Details */}
                        <div className="md:col-span-2 space-y-6">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="w-5 h-5 text-gray-400" />
                                Product Details
                            </h2>
                            <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                                <div className="w-20 h-20 bg-white rounded-md flex-shrink-0 overflow-hidden border relative">
                                    {order.product?.images?.[0] && (
                                        <Image src={order.product.images[0]} alt="" fill className="object-cover" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900">{order.product?.name}</h3>
                                    <div className="text-sm text-gray-500 mt-1">
                                        Quantity: <span className="font-semibold text-gray-900">{order.quantity} units</span>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Unit Price: {formatCurrency(order.unit_price)}
                                    </div>
                                </div>
                                <div className="ml-auto text-right">
                                    <div className="text-sm text-gray-500">Total Paid</div>
                                    <div className="text-xl font-bold text-gray-900">
                                        {formatCurrency(order.total_amount)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Manufacturer / Shipping From */}
                        <div className="space-y-6">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-gray-400" />
                                Sold By
                            </h2>
                            <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
                                <div className="font-medium text-gray-900">{order.manufacturer?.business_name}</div>
                                <div className="text-gray-600">
                                    {order.manufacturer?.city}, {order.manufacturer?.state}
                                </div>
                                <div className="pt-2 border-t border-gray-200 mt-2">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">EMAIL</span>
                                        {order.manufacturer?.email}
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
