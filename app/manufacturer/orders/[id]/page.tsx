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
    FileText,
    ExternalLink,
    CheckCircle
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { generateInvoice } from '@/lib/invoice-generator'
import { Order } from '@/types'

export default function ManufacturerOrderDetails() {
    const params = useParams()
    const [order, setOrder] = useState<Order | any>(null)
    const [loading, setLoading] = useState(true)
    const [generatingLabel, setGeneratingLabel] = useState(false)

    useEffect(() => {
        fetchOrder()
    }, [])

    const fetchOrder = async () => {
        const orderId = params.id as string
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                product:products(name, images, base_price, weight, length, breadth, height),
                retailer:users!orders_retailer_id_fkey(business_name, email, phone, address, city, state, pincode),
                manufacturer:users!orders_manufacturer_id_fkey(address, phone, pincode, city)
            `)
            .eq('id', orderId)
            .single()

        if (data) {
            const typedOrder = data as Order | any
            setOrder(typedOrder)

            // Auto-track if AWB exists and not in a final state
            const finalStates = ['delivered', 'cancelled', 'rto_delivered']
            if (typedOrder.awb_code && !finalStates.includes(typedOrder.status)) {
                fetch('/api/shiprocket/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: typedOrder.id })
                }).then(res => res.json()).then(trackRes => {
                    if (trackRes.updated) fetchOrder()
                }).catch(err => console.error('Auto-track error', err))
            }
        }
        setLoading(false)
    }

    const handleCreateShipment = async () => {
        // Validation: Ensure manufacturer has pickup details
        const manuf = order?.manufacturer
        if (!manuf?.address || !manuf?.phone || !manuf?.pincode || !manuf?.city) {
            alert('Please complete your Business Profile (Address/Phone) before shipping.')
            return
        }

        if (!confirm(`Create shipment using ${order.courier_name || 'selected courier'}?`)) return

        setGeneratingLabel(true)
        try {
            const res = await fetch('/api/shiprocket/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id })
            })

            const data = await res.json()

            if (data.success) {
                alert('Shipment Created! AWB: ' + data.awb)
                fetchOrder()
            } else {
                alert('Failed: ' + (data.error || JSON.stringify(data)))
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Failed to connect to server')
        } finally {
            setGeneratingLabel(false)
        }
    }

    const downloadLabel = async () => {
        if (!order.shipment_id) return alert('No Shipment ID found')

        try {
            // If we already have a label URL stored (future optimization), use it.
            // For now, generate fresh every time or checking if we stored it?
            // We'll call the API to get the label URL
            const response = await fetch('/api/shiprocket/generate-label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shipmentId: order.shipment_id })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error)

            window.open(data.label_url, '_blank')

        } catch (error: any) {
            alert('Failed to download label: ' + error.message)
        }
    }

    const handleMarkDelivered = async () => {
        if (!confirm('Are you sure you want to mark this order as Delivered? This will enable payout pending status.')) return

        try {
            const { error } = await (supabase
                .from('orders') as any)
                .update({ status: 'delivered' })
                .eq('id', order.id)

            if (error) throw error

            alert('Order marked as Delivered!')
            fetchOrder()
        } catch (error: any) {
            alert('Error: ' + error.message)
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
                    <Link href="/manufacturer/orders" className="flex items-center text-gray-500 hover:text-gray-900 mb-6">
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
                                    {order.awb_code && (
                                        <span className="flex items-center gap-1 font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                                            AWB: {order.awb_code}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => generateInvoice(order)}
                                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Invoice
                                </button>
                                {['confirmed', 'paid', 'pending'].includes(order.status) && !order.awb_code && (
                                    <div className="flex items-center gap-3">
                                        {order.courier_name && (
                                            <div className="text-right">
                                                <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Retailer Selected</div>
                                                <div className="text-sm font-semibold text-emerald-600">{order.courier_name}</div>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleCreateShipment()}
                                            disabled={generatingLabel}
                                            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-medium shadow-sm transition-all"
                                        >
                                            {generatingLabel ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Truck className="w-4 h-4" />
                                            )}
                                            Ship & Request Pickup
                                        </button>
                                    </div>
                                )}

                                {order.awb_code && (
                                    <>
                                        <button
                                            onClick={downloadLabel}
                                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4" />
                                            Download Label
                                        </button>
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
                                    </>
                                )}
                            </div>
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
                                        <div className="text-sm text-gray-500">Total Payout</div>
                                        <div className="text-xl font-bold text-emerald-600">
                                            {formatCurrency(order.manufacturer_payout)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Retailer / Shipping Details */}
                            <div className="space-y-6">
                                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-gray-400" />
                                    Shipping Address
                                </h2>
                                <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
                                    <div className="font-medium text-gray-900">{order.retailer?.business_name}</div>
                                    <div className="text-gray-600">
                                        {order.retailer?.address}<br />
                                        {order.retailer?.city}, {order.retailer?.state} - {order.retailer?.pincode}
                                    </div>
                                    <div className="pt-2 border-t border-gray-200 mt-2">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">EMAIL</span>
                                            {order.retailer?.email}
                                        </div>
                                        {/* Phone hidden for privacy if needed, or shown */}
                                        {/* <div className="flex items-center gap-2 text-gray-600 mt-1">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">PHONE</span>
                                        {order.retailer?.phone}
                                    </div> */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}
