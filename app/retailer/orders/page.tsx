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
    MapPin,
    Eye
} from 'lucide-react'
import { generateInvoice } from '@/lib/invoice-generator'
import { useStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

// Helper Interface for Grouped Orders
interface GroupedOrder {
    order_number: string
    created_at: string
    status: string // Use generic string to handle mixed statuses or just first one
    total_amount: number
    pending_amount: number
    payment_type: string
    manufacturer: any
    items: Order[]
}

export default function RetailerOrdersPage() {
    // Keep 'orders' as the raw fetched rows for simplicity in filtering
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const addItems = useStore((state) => state.addItems)
    const router = useRouter()

    const handleBuyAgain = (group: GroupedOrder) => {
        // Add all items from the group to cart
        const cartItems = group.items.map(order => ({
            product: (order as any).product,
            quantity: order.quantity
        })).filter(item => item.product) // Safety check

        if (cartItems.length === 0) return

        addItems(cartItems)
        toast.success(`Added ${cartItems.length} items to cart`)
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

    // --- Grouping Logic ---
    const groupOrders = (rawOrders: Order[]): GroupedOrder[] => {
        const groups: Record<string, GroupedOrder> = {}

        rawOrders.forEach(order => {
            if (!groups[order.order_number]) {
                groups[order.order_number] = {
                    order_number: order.order_number,
                    created_at: order.created_at,
                    status: order.status, // Assuming generic status for now. 
                    total_amount: 0,
                    pending_amount: 0,
                    payment_type: order.payment_type || 'full',
                    manufacturer: (order as any).manufacturer,
                    items: []
                }
            }

            // Add item
            groups[order.order_number].items.push(order)

            // Aggregate totals (assuming 'total_amount' is per line item in DB)
            groups[order.order_number].total_amount += order.total_amount
            groups[order.order_number].pending_amount += (order.pending_amount || 0)
        })

        // Convert map to array and sort by created_at desc
        return Object.values(groups).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    }

    const filteredRawOrders = filter === 'all'
        ? orders
        : orders.filter(o => o.status === filter)

    // Group AFTER filtering to ensure we show groups that match the filter (if any item matches? or if group matches?)
    // Actually, logic: if I filter 'Delivered', I should see groups where status is 'Delivered'.
    // Since we take status from the first item (or common), strict filtering on raw rows works 
    // BUT we might want to show the whole group? 
    // Current logic: Filter raw rows -> Group them. 
    // If an order has mixed statuses (rare), this might show partial groups.
    // For now, assume consistent status per order_number.
    const groupedOrders = groupOrders(filteredRawOrders)

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
                {groupedOrders.length === 0 ? (
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
                        {groupedOrders.map(group => (
                            <div key={group.order_number} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col hover:border-emerald-200 transition-colors">
                                {/* Group Header */}
                                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(group.status)}
                                        <div>
                                            <span className="font-mono text-xs font-medium text-gray-900 block">
                                                #{group.order_number}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(group.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${getStatusBadge(group.status)}`}>
                                        {group.status}
                                    </span>
                                </div>

                                {/* Wholesaler Info */}
                                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-xs text-gray-600">
                                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="truncate font-medium">{group.manufacturer?.business_name}</span>
                                </div>

                                {/* Items List */}
                                <div className="p-4 space-y-3 flex-1">
                                    {group.items.map((item, idx) => (
                                        <div key={item.id || idx} className="flex gap-3">
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 relative">
                                                {(item as any).product?.images?.[0] ? (
                                                    <Image
                                                        src={(item as any).product.images[0]}
                                                        alt=""
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <Package className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-xs font-medium text-gray-900 line-clamp-2" title={(item as any).product?.name}>
                                                    {(item as any).product?.name}
                                                </h4>
                                                <div className="flex items-center justify-between mt-1">
                                                    <div className="text-[10px] text-gray-500">
                                                        Qty: {item.quantity}
                                                    </div>
                                                    <div className="text-xs font-semibold text-gray-900">
                                                        {formatCurrency(item.total_amount)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Group Footer / Totals */}
                                <div className="px-4 pb-3 flex items-end justify-between border-t border-dashed border-gray-100 pt-3">
                                    <div>
                                        <div className="text-xs text-gray-500">Total Amount</div>
                                        <div className="text-sm font-bold text-gray-900">
                                            {formatCurrency(group.total_amount)}
                                        </div>
                                    </div>

                                    {(group.pending_amount || 0) > 0 ? (
                                        <div className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                            Due: {formatCurrency(group.pending_amount)}
                                        </div>
                                    ) : (
                                        <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                                            Paid
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="p-3 border-t bg-gray-50/50 flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => generateInvoice(group.items)}
                                        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                        title="Invoice"
                                    >
                                        <FileText className="w-4 h-4" />
                                    </button>
                                    <Link
                                        href={`/retailer/orders/${group.items[0].id}`}
                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="View Details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleBuyAgain(group)}
                                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Reorder All
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
