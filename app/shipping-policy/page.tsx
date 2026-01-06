import React from 'react'
import { Truck, MapPin, Package, Clock, Shield } from 'lucide-react'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Shipping Policy',
    description: 'D2BCart shipping policy. Learn about dispatch timelines, logistics partners, shipping costs, and pan-India delivery coverage.',
}

export default function ShippingPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <section className="bg-emerald-50 py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Truck className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Shipping Policy</h1>
                    <p className="text-gray-500">How D2BCart handles your B2B logistics.</p>
                </div>
            </section>

            <section className="py-20 px-4">
                <div className="max-w-4xl mx-auto space-y-12">
                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
                            <Clock className="w-6 h-6 text-emerald-600 mb-3" />
                            <h3 className="font-bold text-gray-900 mb-2">Dispatch Timeline</h3>
                            <p className="text-gray-600 text-sm">Manufacturers are required to dispatch orders within 48-72 hours of receiving a confirmed order, unless otherwise specified for bulk manufacturing.</p>
                        </div>
                        <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
                            <MapPin className="w-6 h-6 text-emerald-600 mb-3" />
                            <h3 className="font-bold text-gray-900 mb-2">Pan-India Delivery</h3>
                            <p className="text-gray-600 text-sm">Our logistics partners cover over 26,000+ pin codes across India, including Tier 1, 2, and 3 cities.</p>
                        </div>
                    </div>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <Package className="w-7 h-7 text-emerald-600" />
                            1. Logistics Partners
                        </h2>
                        <p className="text-gray-600 leading-relaxed">
                            We use Shiprocket as our primary logistics aggregator, giving you access to India's top couriers including Delhivery, BlueDart, Xpressbees, and Ecom Express.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <Shield className="w-7 h-7 text-emerald-600" />
                            2. Shipping Costs
                        </h2>
                        <p className="text-gray-600 leading-relaxed">
                            Shipping costs are calculated dynamically at checkout based on:
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 space-y-2">
                            <li>Volumetric weight of the package.</li>
                            <li>Distance between Manufacturer warehouse and Retailer store.</li>
                            <li>Type of service selected (Urgent or Economy).</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900">3. Order Tracking</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Once the Manufacturer generates the shipping label, a unique AWB (Air Waybill) number is assigned. You can track your order in real-time from your "My Orders" dashboard.
                        </p>
                    </section>

                    <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100 italic text-emerald-800 text-sm">
                        For any shipping-related disputes or lost packages, D2BCart provides mediation and insurance claims support through our logistics partners.
                    </div>
                </div>
            </section>
        </div>
    )
}
