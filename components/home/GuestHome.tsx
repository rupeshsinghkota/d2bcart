import Link from 'next/link'
import { ArrowRight, CheckCircle, Shield, Truck } from 'lucide-react'

export default function GuestHome() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white py-20 px-4">
                <div className="max-w-7xl mx-auto md:flex items-center justify-between gap-12">
                    <div className="md:w-1/2 space-y-6">
                        <div className="inline-block bg-emerald-700/50 backdrop-blur-sm border border-emerald-600/50 px-4 py-1.5 rounded-full text-sm font-medium">
                            🇮🇳 India's Trusted B2B Marketplace
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                            Source Directly from <br />
                            <span className="text-emerald-400">Verified Manufacturers</span>
                        </h1>
                        <p className="text-lg text-emerald-100 max-w-xl">
                            Skip the middleman. Get wholesale factory pricing, secure payments, and reliable logistics in one platform.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <Link href="/register?type=retailer" className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 text-center transition-all hover:-translate-y-1">
                                Join as Retailer
                            </Link>
                            <Link href="/register?type=manufacturer" className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white font-bold rounded-xl text-center transition-all">
                                Sell as Manufacturer
                            </Link>
                        </div>
                    </div>
                    <div className="hidden md:block md:w-1/2 relative">
                        {/* Abstract App Visualization */}
                        <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-6 rotate-2 hover:rotate-0 transition-transform duration-500">
                            <div className="flex items-center justify-between mb-4 border-b pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full" />
                                    <div>
                                        <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
                                        <div className="h-3 w-16 bg-gray-100 rounded" />
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                                    Verified
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="h-32 bg-gray-100 rounded-xl w-full" />
                                <div className="flex justify-between items-center">
                                    <div className="h-6 w-1/3 bg-gray-200 rounded" />
                                    <div className="h-8 w-24 bg-emerald-600 rounded-lg" />
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-10 -right-10 w-full h-full bg-emerald-600/30 rounded-2xl blur-3xl -z-10" />
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900">Why choose D2BCart?</h2>
                        <p className="text-gray-600 mt-2">Built for the modern Indian supply chain</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Shield,
                                title: "100% Verified Suppliers",
                                desc: "Every manufacturer is vetted with GST and KYC verification."
                            },
                            {
                                icon: Truck,
                                title: "Nationwide Logistics",
                                desc: "Integrated shipping with Shiprocket. Track orders in real-time."
                            },
                            {
                                icon: CheckCircle,
                                title: "Safe Payments",
                                desc: "Secure transaction processing. Manufacturer gets paid only after dispatch."
                            }
                        ].map((feature, i) => (
                            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                                    <feature.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
