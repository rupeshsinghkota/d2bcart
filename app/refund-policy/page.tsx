'use client'

import React from 'react'
import { RotateCcw, XCircle, AlertCircle, CheckCircle2, History } from 'lucide-react'

export default function RefundPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <section className="bg-emerald-900 py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Refund & Cancellation</h1>
                    <p className="text-emerald-100 opacity-80">Transparent policies for B2B procurement.</p>
                </div>
            </section>

            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto space-y-12">
                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3 border-b border-gray-100 pb-4">
                            <XCircle className="w-7 h-7 text-red-500" />
                            1. Order Cancellation
                        </h2>
                        <div className="space-y-4">
                            <div className="flex gap-4 p-5 bg-gray-50 rounded-2xl">
                                <AlertCircle className="w-6 h-6 text-gray-400 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-gray-900 mb-1">Before Dispatch</h4>
                                    <p className="text-gray-600 text-sm">Retailers can cancel their order within 6 hours of placement or until the manufacturer has accepted and processed the order for dispatch.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-5 bg-red-50 rounded-2xl border border-red-100">
                                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-red-900 mb-1">After Dispatch</h4>
                                    <p className="text-red-700/70 text-sm">Once an order has been dispatched and an AWB is generated, it cannot be cancelled. If rejected at delivery, shipping charges will not be refunded.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3 border-b border-gray-100 pb-4">
                            <RotateCcw className="w-7 h-7 text-emerald-600" />
                            2. Returns & Replacements
                        </h2>
                        <p className="text-gray-600 leading-relaxed text-lg font-medium">
                            Being a B2B marketplace, we only accept returns for the following reasons:
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                "Defective or damaged items",
                                "Wrong product delivered",
                                "Quantity mismatch",
                                "Product significantly different from listing"
                            ].map((reason, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm italic text-gray-600">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    {reason}
                                </div>
                            ))}
                        </div>
                        <p className="text-gray-500 text-sm mt-4 italic">
                            * Claim for transit damage must be filed within 24 hours of delivery with unboxing video evidence.
                        </p>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3 border-b border-gray-100 pb-4">
                            <History className="w-7 h-7 text-blue-500" />
                            3. Refund Process
                        </h2>
                        <div className="bg-blue-50 border border-blue-100 p-8 rounded-[2.5rem] space-y-4">
                            <p className="text-blue-900 leading-relaxed">
                                Approved refunds are processed within 5-7 business days through the original payment method (Razorpay).
                            </p>
                            <ul className="space-y-4 text-blue-800/80 text-sm">
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">1</span>
                                    <span>Raise a dispute via the dashboard within 48 hours of delivery.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">2</span>
                                    <span>D2BCart team mediates with the manufacturer and verifies evidence.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">3</span>
                                    <span>If approved, refund is initiated back to your source bank account.</span>
                                </li>
                            </ul>
                        </div>
                    </section>
                </div>
            </section>
        </div>
    )
}
