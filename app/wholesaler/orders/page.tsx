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
    Truck,
    MapPin,
    Printer,
    RefreshCw,
    CheckSquare,
    Square,
    X,
    AlertCircle,
    Search,
    Calendar,
    ArrowUpDown,
    Filter
} from 'lucide-react'

const OrdersContent = () => {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)

    // Filters State
    const [filter, setFilter] = useState<string>(searchParams.get('status') || 'all')
    const [searchTerm, setSearchTerm] = useState('')
    // Default to Last 7 Days for visibility
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

    const [processingId, setProcessingId] = useState<string | null>(null)

    // Selection State: Tracks selected Order Numbers (Strings)
    const [selectedOrderNumbers, setSelectedOrderNumbers] = useState<Set<string>>(new Set())
    // Expansion State
    const [expandedOrderNumbers, setExpandedOrderNumbers] = useState<Set<string>>(new Set())

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
        product:products(name, images, slug),
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

        setProcessingId(primaryOrder.id || 'bulk')

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
            setSelectedOrderNumbers(new Set()) // Clear selection
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

    // Toggle Order Selection
    const toggleOrderSelection = (orderNumber: string, retailerId: string, hasReadyItems: boolean) => {
        if (!hasReadyItems) return
        const newSelected = new Set(selectedOrderNumbers)
        if (newSelected.has(orderNumber)) {
            newSelected.delete(orderNumber)
            setSelectedOrderNumbers(newSelected)
            return
        }
        if (newSelected.size > 0) {
            const firstSelectedNum = Array.from(newSelected)[0]
            const firstSelectedOrder = orders.find(o => o.order_number === firstSelectedNum)
            if (firstSelectedOrder && firstSelectedOrder.retailer_id !== retailerId) {
                toast.error("Can only bulk ship orders for the SAME Retailer.")
                return
            }
        }
        newSelected.add(orderNumber)
        setSelectedOrderNumbers(newSelected)
    }

    const toggleOrderExpansion = (orderNumber: string) => {
        const newExpanded = new Set(expandedOrderNumbers)
        if (newExpanded.has(orderNumber)) {
            newExpanded.delete(orderNumber)
        } else {
            newExpanded.add(orderNumber)
        }
        setExpandedOrderNumbers(newExpanded)
    }

    // Bulk Ship Execution
    const handleBulkShip = () => {
        const itemsToShip = orders.filter(o =>
            selectedOrderNumbers.has(o.order_number) && o.status === 'paid'
        )
        if (itemsToShip.length === 0) return
        createShipment(itemsToShip)
    }

    // --- Filtering Logic ---
    const filteredOrders = orders.filter(order => {
        // Status Filter
        if (filter !== 'all' && order.status !== filter) return false

        // Search Filter (Order # or Retailer Name)
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            const matchId = order.order_number.toLowerCase().includes(term)
            const matchRetailer = (order as any).retailer?.business_name?.toLowerCase().includes(term)
            if (!matchId && !matchRetailer) return false
        }

        // Date Filter
        if (startDate) {
            const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0)
            const start = new Date(startDate).setHours(0, 0, 0, 0)
            if (orderDate < start) return false
        }
        if (endDate) {
            const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0)
            const end = new Date(endDate).setHours(23, 59, 59, 999)
            if (orderDate > end) return false
        }

        return true
    }).sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

    // Calculate pending earnings
    const pendingEarnings = orders
        .filter(o => ['paid', 'confirmed', 'shipped', 'in_transit', 'out_for_delivery'].includes(o.status))
        .reduce((sum, o) => sum + o.manufacturer_payout, 0)

    // Group orders for rendering
    const groupedOrders = filteredOrders.reduce((acc, order) => {
        if (!acc[order.order_number]) acc[order.order_number] = []
        acc[order.order_number].push(order)
        return acc
    }, {} as Record<string, Order[]>)

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Header & Pending Earnings */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4 pt-4 md:pt-0">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Orders</h1>
                        <p className="text-xs text-gray-500">Manage all your wholesale orders</p>
                    </div>

                    <div className="bg-emerald-600 text-white shadow-lg shadow-emerald-200 rounded-lg px-4 py-2 text-right w-full md:w-auto transform transition-transform hover:scale-105">
                        <div className="text-[10px] font-medium text-emerald-100 uppercase tracking-wider mb-0.5">Pending Earnings</div>
                        <div className="text-xl font-bold flex items-center justify-end gap-1.5">
                            {formatCurrency(pendingEarnings)}
                            <Clock className="w-4 h-4 text-emerald-200" />
                        </div>
                    </div>
                </div>

                {/* Toolbar: Search, Filters, Sort */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-4 space-y-3">
                    <div className="flex flex-col lg:flex-row gap-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by Order ID, Retailer..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                            />
                        </div>

                        {/* Date Range & Quick Filters */}
                        <div className="flex flex-col gap-1.5">
                            {/* Quick Date Tokens */}
                            <div className="flex gap-2 mb-0.5 overflow-x-auto no-scrollbar pb-1">
                                {[
                                    { label: 'Today', days: 0 },
                                    { label: 'Yesterday', days: 1 },
                                    { label: 'Last 7 Days', days: 7 },
                                    { label: 'Last 30 Days', days: 30 },
                                    { label: 'This Month', type: 'month' },
                                    { label: 'All Time', type: 'all' }
                                ].map((filter) => (
                                    <button
                                        key={filter.label}
                                        onClick={() => {
                                            const today = new Date()
                                            let start = ''
                                            let end = today.toISOString().split('T')[0]

                                            if (filter.type === 'all') {
                                                setStartDate('')
                                                setEndDate('')
                                                return
                                            }

                                            if (filter.type === 'month') {
                                                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                                                start = firstDay.toISOString().split('T')[0]
                                            } else if (filter.label === 'Yesterday') {
                                                const yest = new Date(today)
                                                yest.setDate(yest.getDate() - 1)
                                                start = yest.toISOString().split('T')[0]
                                                end = yest.toISOString().split('T')[0]
                                            } else {
                                                const pastDate = new Date(today)
                                                pastDate.setDate(pastDate.getDate() - (filter.days as number))
                                                start = pastDate.toISOString().split('T')[0]
                                            }

                                            setStartDate(start)
                                            setEndDate(end)
                                        }}
                                        className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full whitespace-nowrap transition-colors border border-gray-200"
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="pl-8 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white w-32 sm:w-auto"
                                    />
                                </div>
                                <span className="text-gray-400 text-xs">-</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate}
                                    className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white w-32 sm:w-auto"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2 border-t border-gray-50">
                        {/* Status Filter (Primary) */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar items-center">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-2 flex items-center gap-1">
                                <Filter className="w-3 h-3" /> Status:
                            </span>
                            {['all', 'paid', 'confirmed', 'shipped', 'cancelled'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${filter === status
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="text-xs text-gray-500">Sort:</span>
                            <div className="relative">
                                <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                                    className="pl-8 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                                    style={{ backgroundImage: 'none' }} // Hide default arrow to use custom styling if needed, but simple select is fine
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Orders List */}
                {Object.keys(groupedOrders).length === 0 ? (
                    <div className="bg-white rounded-xl p-16 text-center border dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-300" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">No orders matched</h2>
                        <p className="text-gray-500 max-w-md mx-auto">
                            We couldn't find any orders matching your filters. Try adjusting dates or search terms.
                        </p>
                        <button
                            onClick={() => {
                                setFilter('all')
                                setSearchTerm('')
                                setStartDate('')
                                setEndDate('')
                            }}
                            className="mt-6 text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedOrders).map(([orderNumber, group]) => {
                            const firstOrder = group[0]
                            const totalPayout = group.reduce((sum, o) => sum + o.manufacturer_payout, 0)
                            const totalPending = group.reduce((sum, o) => sum + (o.pending_amount || 0), 0)
                            const itemsReadyToShip = group.filter(o => o.status === 'paid')
                            const hasReadyItems = itemsReadyToShip.length > 0

                            const isSelected = selectedOrderNumbers.has(orderNumber)
                            const isExpanded = expandedOrderNumbers.has(orderNumber)

                            // Check isDisabled (for checkbox)
                            let isDisabled = false
                            if (selectedOrderNumbers.size > 0 && !isSelected) {
                                const firstSelectedNum = Array.from(selectedOrderNumbers)[0]
                                const firstSelectedOrder = orders.find(o => o.order_number === firstSelectedNum)
                                if (firstSelectedOrder && firstSelectedOrder.retailer_id !== firstOrder.retailer_id) {
                                    isDisabled = true
                                }
                            }
                            if (!hasReadyItems) isDisabled = true

                            // Overall Status
                            const isAllDelivered = group.every(o => o.status === 'delivered')
                            const isAllShipped = group.every(o => o.status === 'shipped' || o.status === 'delivered')
                            const isAllConfirmed = group.every(o => ['confirmed', 'shipped', 'delivered'].includes(o.status))
                            const isAllPaid = group.every(o => ['paid', 'confirmed', 'shipped', 'delivered'].includes(o.status))

                            let overallStatus = 'pending'
                            if (group.every(o => o.status === 'cancelled')) overallStatus = 'cancelled'
                            else if (isAllDelivered) overallStatus = 'delivered'
                            else if (isAllShipped) overallStatus = 'shipped'
                            else if (isAllConfirmed) overallStatus = 'confirmed'
                            else if (isAllPaid) overallStatus = 'paid'
                            else if (group.some(o => o.status !== 'pending')) overallStatus = 'in_progress'

                            const unifiedAwb = group.every(o => o.awb_code && o.awb_code === firstOrder.awb_code) ? firstOrder.awb_code : null
                            const unifiedLabelUrl = group.every(o => o.shipping_label_url === firstOrder.shipping_label_url) ? firstOrder.shipping_label_url : null

                            return (
                                <div key={orderNumber} className={`bg-white rounded-xl shadow-sm overflow-hidden border transition-all ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-100 hover:shadow-md'}`}>
                                    {/* Unified Order Header */}
                                    <div className="p-3 border-b border-gray-100 bg-white">
                                        <div className="flex flex-col md:flex-row justify-between gap-3">
                                            <div className="flex gap-3">

                                                {/* Left: Checkbox (Select Order) */}
                                                <button
                                                    onClick={() => toggleOrderSelection(orderNumber, firstOrder.retailer_id, hasReadyItems)}
                                                    disabled={isDisabled && !isSelected}
                                                    className={`mt-1 w-6 h-6 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${isSelected
                                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                                        : isDisabled
                                                            ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                                                            : 'bg-white border-gray-300 hover:border-emerald-500'
                                                        }`}
                                                    title={!hasReadyItems ? "No items ready to ship" : isDisabled ? "Different retailer selected" : "Select order for bulk shipping"}
                                                >
                                                    {isSelected && <CheckSquare className="w-4 h-4" />}
                                                    {!isSelected && !isDisabled && <Square className="w-4 h-4" />}
                                                    {!isSelected && isDisabled && <AlertCircle className="w-4 h-4" />}
                                                </button>

                                                {/* Order Info */}
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                        <span className="text-base font-bold text-gray-900 tracking-tight">
                                                            {orderNumber}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${getStatusBadge(overallStatus)}`}>
                                                            {overallStatus.replace('_', ' ')}
                                                        </span>
                                                        {hasReadyItems && (
                                                            <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold">
                                                                {itemsReadyToShip.length} Ready
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(firstOrder.created_at).toLocaleDateString('en-IN', {
                                                            day: 'numeric', month: 'short', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </div>
                                                    <div className="mt-2 flex items-center gap-3 text-xs">
                                                        <div className="font-medium text-gray-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                            Payout: <span className="text-emerald-700 font-bold">{formatCurrency(totalPayout)}</span>
                                                        </div>
                                                        {totalPending > 0 && (
                                                            <div className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 font-medium">
                                                                Pending COD: {formatCurrency(totalPending)}
                                                            </div>
                                                        )}
                                                    </div>
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
                                                    {/* Ship Order Button (Quick Action) */}
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
                                                            Ship Order
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

                                    {/* Collapsible Items List */}
                                    {isExpanded && (
                                        <div className="bg-gray-50/30 border-t border-gray-100 animate-in fade-in slide-in-from-top-1">
                                            {group.map((order, index) => (
                                                <div key={order.id} className={`p-3 flex flex-row gap-3 items-start ${index !== group.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                                    <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex-shrink-0 relative overflow-hidden">
                                                        <Link
                                                            href={`/products/${(order as any).product?.slug || (order as any).product_id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {(order as any).product?.images?.[0] ? (
                                                                <Image
                                                                    src={(order as any).product.images[0]}
                                                                    alt=""
                                                                    fill
                                                                    className="object-cover"
                                                                />
                                                            ) : (
                                                                <Package className="w-4 h-4 text-gray-300 m-auto translate-y-3" />
                                                            )}
                                                        </Link>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                                                            <Link
                                                                href={`/products/${(order as any).product?.slug || (order as any).product_id}`}
                                                                className="hover:text-emerald-600 transition-colors"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                {(order as any).product?.name}
                                                            </Link>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
                                                            <span>{order.quantity} units</span>
                                                            <span>×</span>
                                                            <span>{formatCurrency(order.unit_price)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex-shrink-0 self-center">
                                                        <Link
                                                            href={`/wholesaler/orders/${order.id}`}
                                                            className="text-gray-400 hover:text-emerald-600 p-1 block"
                                                        >
                                                            <ArrowLeft className="w-4 h-4 rotate-180" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Footer / Expansion Toggle */}
                                    <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-wider font-semibold hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => toggleOrderExpansion(orderNumber)}>
                                        <div>{group.length} Product{group.length > 1 ? 's' : ''}</div>
                                        <div className="flex gap-4 items-center">
                                            <span>Pay: {group[0].payment_type === 'advance' ? 'COD (Shipping Paid)' : 'Full'}</span>
                                            <span className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700">
                                                {isExpanded ? 'Hide' : 'View'}
                                                <ArrowLeft className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : '-rotate-90'}`} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bulk Actions Floating Bar */}
            {selectedOrderNumbers.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <div className="font-medium">
                        {selectedOrderNumbers.size} Order{selectedOrderNumbers.size > 1 ? 's' : ''} selected
                    </div>
                    <div className="h-6 w-px bg-gray-600" />
                    <button
                        onClick={handleBulkShip}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-full font-bold text-sm transition-colors"
                        disabled={!!processingId}
                    >
                        {processingId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                        Ship {selectedOrderNumbers.size} Orders
                    </button>
                    <button
                        onClick={() => setSelectedOrderNumbers(new Set())}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}
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
