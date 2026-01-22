'use client'

import { useState, useEffect, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { Order } from '@/types'
import {
    Search,
    Filter,
    Package,
    Calendar,
    User as UserIcon,
    Building2,
    Truck,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    IndianRupee,
    Info,
    CreditCard
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

// Define a type for the Group
interface OrderGroup {
    groupId: string
    paymentId: string
    orders: Order[]
    totalAmount: number
    retailer: any
    createdAt: string
    status: string // Aggregate status
    itemsCount: number
}

export default function AdminOrdersPage() {
    const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // 'all', 'pending', 'shipping', 'delivered', 'cancelled'
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                product:products(name, images),
                retailer:users!retailer_id(business_name, email, phone, city),
                manufacturer:users!manufacturer_id(business_name, email, phone, city)
            `)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching orders:', error)
            toast.error('Failed to load orders')
        } else if (data) {
            // Group orders by payment_id
            const groups: Record<string, OrderGroup> = {}

            data.forEach((order: any) => {
                // Use payment_id as key, or fallback to order_id if missing (legacy)
                const key = order.payment_id || order.id

                if (!groups[key]) {
                    groups[key] = {
                        groupId: key,
                        paymentId: order.payment_id,
                        orders: [],
                        totalAmount: 0,
                        retailer: order.retailer,
                        createdAt: order.created_at,
                        status: order.status, // Initial status (will refine)
                        itemsCount: 0
                    }
                }

                groups[key].orders.push(order)
                groups[key].totalAmount += order.total_amount
                groups[key].itemsCount += 1
            })

            // Array conversion and sort
            const groupArray = Object.values(groups).sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )

            setOrderGroups(groupArray)
        }
        setLoading(false)
    }

    const filteredGroups = orderGroups.filter(group => {
        // Filter by Status (if ANY order in group matches? Or if group "main" status matches? Let's check ANY)
        if (filter !== 'all') {
            const hasStatus = group.orders.some(o => o.status === filter)
            if (!hasStatus) return false
        }

        // Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            const matchesGroup =
                (group.paymentId && group.paymentId.toLowerCase().includes(query)) ||
                group.retailer?.business_name?.toLowerCase().includes(query) ||
                group.retailer?.email?.toLowerCase().includes(query) ||
                group.retailer?.phone?.toLowerCase().includes(query)

            const matchesItems = group.orders.some(o =>
                o.order_number.toLowerCase().includes(query) ||
                o.product?.name?.toLowerCase().includes(query) ||
                o.manufacturer?.business_name?.toLowerCase().includes(query)
            )

            return matchesGroup || matchesItems
        }
        return true
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-700'
            case 'confirmed': return 'bg-blue-100 text-blue-700'
            case 'shipped': return 'bg-purple-100 text-purple-700'
            case 'delivered': return 'bg-green-100 text-green-700'
            case 'cancelled': return 'bg-red-100 text-red-700'
            case 'paid': return 'bg-emerald-100 text-emerald-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
                <p className="text-gray-600">Track and manage orders (Grouped by Payment)</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by Order #, Payment ID, Retailer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    {['all', 'pending', 'paid', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors ${filter === f
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Groups Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Group / Payment ID</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Retailer</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Total Amount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Items</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredGroups.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No orders found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredGroups.map(group => (
                                    <Fragment key={group.groupId}>
                                        <tr
                                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedGroupId === group.groupId ? 'bg-gray-50' : ''}`}
                                            onClick={() => setExpandedGroupId(expandedGroupId === group.groupId ? null : group.groupId)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900 text-sm">
                                                        {group.paymentId ? `${group.paymentId.slice(0, 15)}...` : 'Manual/Legacy'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 pl-6">
                                                    {group.orders[0].order_number} {group.itemsCount > 1 ? `+ ${group.itemsCount - 1} more` : ''}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    {new Date(group.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1 pl-6">
                                                    {new Date(group.createdAt).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700">{group.retailer?.business_name || 'Unknown'}</span>
                                                </div>
                                                <div className="text-xs text-gray-400 ml-6">{group.retailer?.city}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-900">
                                                {formatCurrency(group.totalAmount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">
                                                    {group.itemsCount} Items
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    {expandedGroupId === group.groupId ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded Details - The "Sub Orders" */}
                                        {expandedGroupId === group.groupId && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={6} className="p-4 md:p-6">
                                                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 flex justify-between">
                                                            <span>Order Contents & Breakdown</span>
                                                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <CheckCircle className="w-3 h-3" />
                                                                Payment: {group.orders[0].payment_type === 'advance' ? 'COD (Ship Paid)' : 'Prepaid'}
                                                            </span>
                                                        </div>
                                                        <div className="divide-y divide-gray-100">
                                                            {group.orders.map(order => (
                                                                <div key={order.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                                                                    <div className="flex flex-col md:flex-row gap-6">
                                                                        {/* 1. Product & Basic Info */}
                                                                        <div className="flex gap-4 flex-1">
                                                                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                                                                                {/* Assuming image is array */}
                                                                                {order.product?.images?.[0] ? (
                                                                                    <img src={order.product.images[0]} alt="" className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                                        <Package className="w-6 h-6" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-bold text-gray-900">{order.product?.name}</div>
                                                                                <div className="text-xs text-gray-500 mt-1">Order #: {order.order_number}</div>
                                                                                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                                                    <Building2 className="w-3 h-3" />
                                                                                    Wholesaler: <span className="text-gray-700 font-medium">{order.manufacturer?.business_name}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* 2. Status & Tracking */}
                                                                        <div className="flex-1 md:border-l md:border-r border-gray-100 md:px-6">
                                                                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                                                                <div className="text-gray-500 text-xs">Status</div>
                                                                                <div>
                                                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${getStatusColor(order.status)}`}>
                                                                                        {order.status}
                                                                                    </span>
                                                                                </div>

                                                                                <div className="text-gray-500 text-xs">Tracking</div>
                                                                                <div className="text-gray-900 font-medium truncate" title={order.tracking_number || order.awb_code}>
                                                                                    {order.tracking_number || order.awb_code || 'Not shipped'}
                                                                                </div>

                                                                                <div className="text-gray-500 text-xs">Courier</div>
                                                                                <div className="text-gray-700">{order.courier_name || '-'}</div>
                                                                            </div>
                                                                        </div>

                                                                        {/* 3. Financials (Admin View) */}
                                                                        <div className="flex-1">
                                                                            <div className="space-y-1.5 text-sm">
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-gray-500 flex items-center gap-1">
                                                                                        <Info className="w-3 h-3" /> Sales Price
                                                                                    </span>
                                                                                    <span className="font-medium">{formatCurrency(order.total_amount)}</span>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs text-gray-500">
                                                                                    <span>Qty: {order.quantity} x {formatCurrency(order.unit_price)}</span>
                                                                                    <span>+ Ship: {formatCurrency(order.shipping_cost || 0)}</span>
                                                                                </div>

                                                                                <div className="border-t border-dashed border-gray-200 my-2"></div>

                                                                                <div className="flex justify-between text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                                                                    <span className="text-xs font-medium">Mfr Payout</span>
                                                                                    <span className="font-bold">{formatCurrency(order.manufacturer_payout)}</span>
                                                                                </div>

                                                                                <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded mt-1">
                                                                                    <span className="text-xs font-medium">Platform Profit</span>
                                                                                    <span className="font-bold">{formatCurrency(order.platform_profit)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Timestamps Footer */}
                                                                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                                                                        {order.shipped_at && (
                                                                            <span className="flex items-center gap-1">
                                                                                <Truck className="w-3 h-3 text-purple-500" />
                                                                                Shipped: {new Date(order.shipped_at).toLocaleString()}
                                                                            </span>
                                                                        )}
                                                                        {order.delivered_at && (
                                                                            <span className="flex items-center gap-1">
                                                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                                                                Delivered: {new Date(order.delivered_at).toLocaleString()}
                                                                            </span>
                                                                        )}
                                                                        {!order.shipped_at && !order.delivered_at && (
                                                                            <span className="flex items-center gap-1 text-gray-400">
                                                                                <Clock className="w-3 h-3" /> Awaiting Shipment
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Shipping Address</h4>
                                                            <p className="text-sm text-gray-700">{group.orders[0].shipping_address}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

