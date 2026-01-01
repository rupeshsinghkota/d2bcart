'use client'

import React from 'react'
import { FileText, Calculator, ShieldCheck, Landmark, AlertCircle } from 'lucide-react'

export default function GSTInfoPage() {
    return (
        <div className="min-h-screen bg-white">
            <section className="bg-emerald-50 py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <FileText className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">GST Information</h1>
                    <p className="text-gray-500">How taxation works on the D2BCart platform.</p>
                </div>
            </section>

            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto space-y-12">
                    <div className="p-8 bg-emerald-900 rounded-[2.5rem] text-white">
                        <div className="flex gap-4 mb-6">
                            <ShieldCheck className="w-10 h-10 text-emerald-400 shrink-0" />
                            <div>
                                <h2 className="text-2xl font-bold">100% Tax Compliant</h2>
                                <p className="text-emerald-100/80">D2BCart is built to handle complex Indian B2B taxation automatically.</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-5 bg-white/10 rounded-2xl border border-white/10">
                                <h4 className="font-bold mb-2">For Manufacturers</h4>
                                <p className="text-sm text-emerald-50 opacity-80 leading-relaxed">Ensure all products have correct HSN codes and GST percentages (5%, 12%, 18%, or 28%).</p>
                            </div>
                            <div className="p-5 bg-white/10 rounded-2xl border border-white/10">
                                <h4 className="font-bold mb-2">For Retailers</h4>
                                <p className="text-sm text-emerald-50 opacity-80 leading-relaxed">Provide your GSTIN during checkout to claim Input Tax Credit (ITC) on your business purchases.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                                <Calculator className="w-6 h-6 text-emerald-600" />
                                Tax Calculation
                            </h2>
                            <p className="text-gray-600 leading-relaxed text-sm">
                                Our system automatically identifies whether an order is Inter-state (IGST) or Intra-state (CGST + SGST) based on the manufacturer's warehouse and the retailer's delivery address.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                                <Landmark className="w-6 h-6 text-emerald-600" />
                                GST Invoicing
                            </h2>
                            <p className="text-gray-600 leading-relaxed text-sm">
                                Every order generates a digital Tax Invoice that includes the GSTIN of both parties, HSN breakdown, and taxable values. You can download these from your dashboard at any time.
                            </p>
                        </section>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-8 rounded-2xl flex gap-4">
                        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                        <div>
                            <h4 className="text-amber-900 font-bold mb-1">Important Note</h4>
                            <p className="text-amber-800/80 text-sm leading-relaxed">
                                Under Section 194R of the Income Tax Act, certain transactions may be subject to TDS/TCS. Our platform helps you track these requirements, but we recommend consulting your tax advisor for specific filings.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
