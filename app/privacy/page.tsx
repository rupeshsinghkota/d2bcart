'use client'

import React from 'react'
import { Shield, FileText, Lock, Eye, Bell } from 'lucide-react'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white">
            <section className="bg-emerald-50 py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Shield className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
                    <p className="text-gray-500">Last Updated: January 01, 2026</p>
                </div>
            </section>

            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto prose prose-emerald max-w-none">
                    <div className="space-y-12">
                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                <FileText className="w-6 h-6 text-emerald-600" />
                                1. Information We Collect
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                D2BCart collects information about you when you register for an account, use our services, or communicate with us. This includes Personal Information like your name, business name, address, phone number, email address, GSTIN, and financial information for payout processing.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                <Eye className="w-6 h-6 text-emerald-600" />
                                2. How We Use Your Information
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                We use your info to facilitate transactions, manage your account, verify your business credentials, process payments, and improve our services. We may also send you marketing communications, which you can opt-out of at any time.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-600">
                                <li>To verify manufacturer credentials and factory locations.</li>
                                <li>To calculate accurate shipping rates via Shiprocket.</li>
                                <li>To generate GST compliant invoices for your orders.</li>
                                <li>To prevent fraudulent activities and ensure platform security.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                <Lock className="w-6 h-6 text-emerald-600" />
                                3. Data Protection & Security
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                We implement industry-standard security measures to protect your unauthorized access, alteration, or disclosure of data. Your login credentials and payment tokens are encrypted and handled through secure providers like Supabase and Razorpay.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                <Bell className="w-6 h-6 text-emerald-600" />
                                4. Cookie Policy
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                Our platform uses cookies to maintain user sessions, remember preferences, and gather analytics. You can manage cookie settings in your browser at any time.
                            </p>
                        </section>

                        <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100 mt-12">
                            <h3 className="text-lg font-bold text-emerald-800 mb-2">Contact D2BCart Privacy Team</h3>
                            <p className="text-emerald-700/80 mb-4">If you have any questions regarding your data or this policy, please reach out.</p>
                            <a href="mailto:privacy@d2bcart.com" className="text-emerald-700 font-bold hover:underline">privacy@d2bcart.com</a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
