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
    ChevronUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // 'all', 'pending', 'shipping', 'delivered', 'cancelled'
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

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
            setOrders(data as Order[])
        }
        setLoading(false)
    }

    const filteredOrders = orders.filter(order => {
        if (filter !== 'all' && order.status !== filter) return false

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
                order.order_number.toLowerCase().includes(query) ||
                order.retailer?.business_name?.toLowerCase().includes(query) ||
                order.manufacturer?.business_name?.toLowerCase().includes(query) ||
                order.product?.name?.toLowerCase().includes(query)
            )
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
                <p className="text-gray-600">Track and manage all orders securely</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by Order #, Retailer, Product..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(f => (
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

            {/* Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Order</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Retailer</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Wholesaler</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        No orders found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <Fragment key={order.id}>
                                        <tr className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{order.order_number}</div>
                                                <div className="text-xs text-gray-500">{order.product?.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700">{order.retailer?.business_name || 'Unknown'}</span>
                                                </div>
                                                <div className="text-xs text-gray-400 ml-6">{order.retailer?.city}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700">{order.manufacturer?.business_name || 'Unknown'}</span>
                                                </div>
                                                <div className="text-xs text-gray-400 ml-6">{order.manufacturer?.city}</div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {formatCurrency(order.total_amount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    {expandedOrderId === order.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedOrderId === order.id && (
                                            <tr key={`${order.id}-details`} className="bg-gray-50">
                                                <td colSpan={7} className="px-6 py-4">
                                                    <div className="grid md:grid-cols-3 gap-6 text-sm">
                                                        <div className="space-y-2">
                                                            <h4 className="font-semibold text-gray-900">Shipping Details</h4>
                                                            <p className="text-gray-600 whitespace-pre-wrap">{order.shipping_address}</p>
                                                            {order.awb_code && (
                                                                <div className="mt-2 text-indigo-600">AWB: {order.awb_code}</div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h4 className="font-semibold text-gray-900">Contact Info</h4>
                                                            <div>
                                                                <div className="text-gray-500 text-xs">Retailer Phone</div>
                                                                <div>{order.retailer?.phone}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-500 text-xs">Retailer Email</div>
                                                                <div>{order.retailer?.email}</div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h4 className="font-semibold text-gray-900">Financials</h4>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">Unit Price:</span>
                                                                <span>{formatCurrency(order.unit_price)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">Quantity:</span>
                                                                <span>{order.quantity}</span>
                                                            </div>
                                                            <div className="flex justify-between pt-2 border-t border-gray-200 font-medium">
                                                                <span>Total:</span>
                                                                <span>{formatCurrency(order.total_amount)}</span>
                                                            </div>
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
