'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
    ArrowLeft,
    Wallet,
    CheckCircle,
    Clock,
    Download
} from 'lucide-react'

interface Payout {
    id: string
    manufacturer_id: string
    order_id: string
    amount: number
    status: string
    payment_reference?: string
    created_at: string
    order?: {
        order_number: string
        product?: {
            name: string
        }
    }
}

export default function ManufacturerPayoutsPage() {
    const [payouts, setPayouts] = useState<Payout[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPayouts()
    }, [])

    const fetchPayouts = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('payouts')
            .select(`
                *,
                order:orders(
                    order_number,
                    product:products(name)
                )
            `)
            .eq('manufacturer_id', user.id)
            .order('created_at', { ascending: false })

        if (data) setPayouts(data as any)
        setLoading(false)
    }

    const totalReceived = payouts.reduce((sum, p) => p.status === 'completed' ? sum + p.amount : sum, 0)
    const pendingPayouts = payouts.reduce((sum, p) => p.status === 'pending' ? sum + p.amount : sum, 0)

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
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Payouts History</h1>
                            <p className="text-gray-600">Track your received payments</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-emerald-600 text-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-emerald-100 font-medium">Total Received</span>
                        </div>
                        <div className="text-3xl font-bold">{formatCurrency(totalReceived)}</div>
                    </div>
                    {/* Placeholder for future "Pending" specific logic if we track it in payouts table before completion */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <Clock className="w-6 h-6 text-gray-600" />
                            </div>
                            <span className="text-gray-600 font-medium">Processing</span>
                        </div>
                        <div className="text-3xl font-bold text-gray-900">{formatCurrency(pendingPayouts)}</div>
                    </div>
                </div>

                {/* Payouts List */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="font-semibold text-lg text-gray-900">Recent Transactions</h2>
                    </div>

                    {payouts.length === 0 ? (
                        <div className="p-12 text-center">
                            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">No payouts yet</h3>
                            <p className="text-gray-500 mt-1">Payments will appear here once processed by admin.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {payouts.map((payout) => (
                                        <tr key={payout.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {formatDate(payout.created_at)}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="font-medium text-gray-900">
                                                    #{payout.order?.order_number || 'N/A'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {payout.order?.product?.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">
                                                {payout.payment_reference || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {payout.status === 'completed' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Received
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                        <Clock className="w-3 h-3" />
                                                        Processing
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-emerald-600">
                                                {formatCurrency(payout.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
