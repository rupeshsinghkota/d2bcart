'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, User } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle, Clock, Search, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface PayoutOrder extends Order {
    manufacturer: User
    payout_process_state?: 'processing' | 'completed' // Local state for UI
}

export default function AdminPayoutsPage() {
    const [orders, setOrders] = useState<PayoutOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetchPendingPayouts()
    }, [])

    const fetchPendingPayouts = async () => {
        // Fetch orders that are delivered or shipped but payout NOT created
        // Since we don't have a direct "payout_id" on orders in the schema yet (or logic to check against payouts table),
        // we'll fetch orders and verify against payouts table.
        // For MVP, let's assume if it's not in 'payouts' table, it's pending.

        // 1. Get all payouts to filter out paid orders
        const { data: payouts } = await supabase.from('payouts').select('order_id')
        const paidOrderIds = new Set(payouts?.map(p => p.order_id))

        // 2. Get completed orders
        const { data: ordersData } = await supabase
            .from('orders')
            .select(`
                *,
                manufacturer:users!orders_manufacturer_id_fkey(*)
            `)
            .in('status', ['delivered', 'shipped']) // Payout eligible after shipping? Or delivery. Let's say Shipped+ for faster payouts. 
            // Better: Delivered for safety. Let's use Delivered.
            .eq('status', 'delivered')
            .order('created_at', { ascending: false })

        if (ordersData) {
            // Filter out already paid ones
            const pending = (ordersData as PayoutOrder[]).filter(o => !paidOrderIds.has(o.id))
            setOrders(pending)
        }
        setLoading(false)
    }

    const handleMarkAsPaid = async (order: PayoutOrder) => {
        const confirm = window.confirm(`Confirm payout of ${formatCurrency(order.manufacturer_payout)} to ${order.manufacturer?.business_name}?`)
        if (!confirm) return

        // Optimistic update
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payout_process_state: 'processing' } : o))

        const { error } = await supabase
            .from('payouts')
            .insert({
                manufacturer_id: order.manufacturer_id,
                order_id: order.id,
                amount: order.manufacturer_payout,
                status: 'completed', // We assume admin did it instantly manually
                payment_reference: 'MANUAL_ADMIN_TRANSFER'
            })

        if (error) {
            toast.error('Failed to record payout')
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payout_process_state: undefined } : o))
        } else {
            toast.success('Payout recorded successfully')
            setOrders(prev => prev.filter(o => o.id !== order.id)) // Remove from list
            setProcessedIds(prev => new Set(prev).add(order.id))
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
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Pending Payouts</h1>
                <p className="text-gray-600">Review and process payments for delivered orders</p>
            </div>

            {orders.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                    <CheckCircle className="w-16 h-16 text-green-100 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900">All caught up!</h2>
                    <p className="text-gray-500">No pending payouts found.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                                <tr>
                                    <th className="px-6 py-4">Order ID</th>
                                    <th className="px-6 py-4">Manufacturer</th>
                                    <th className="px-6 py-4">Bank Details</th>
                                    <th className="px-6 py-4 text-right">Payout Amount</th>
                                    <th className="px-6 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {orders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-mono font-medium text-gray-900">{order.order_number}</div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{order.manufacturer?.business_name}</div>
                                            <div className="text-xs text-gray-500">{order.manufacturer?.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.manufacturer?.bank_account ? (
                                                <div className="text-gray-700">
                                                    <div>Acc: <span className="font-mono">{order.manufacturer.bank_account}</span></div>
                                                    <div>IFSC: <span className="font-mono">{order.manufacturer.ifsc_code}</span></div>
                                                </div>
                                            ) : (
                                                <span className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded">
                                                    Details Missing
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-emerald-600 text-lg">
                                                {formatCurrency(order.manufacturer_payout)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleMarkAsPaid(order)}
                                                disabled={order.payout_process_state === 'processing'}
                                                className="btn-primary py-2 px-4 text-sm flex items-center justify-center gap-2 min-w-[140px]"
                                            >
                                                {order.payout_process_state === 'processing' ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : 'Mark Paid'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
