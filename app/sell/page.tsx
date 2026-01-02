'use client';

import { ArrowRight, CheckCircle2, MessageSquare, Package, Smartphone, Truck } from 'lucide-react';
import Link from 'next/link';

export default function SellerPage() {
    const whatsappNumber = '919117474683'; // Verified support number
    const whatsappMessage = encodeURIComponent('Hi, I am a manufacturer/importer and I want to sell my products on d2bcart.');
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Hero Section */}
            <div className="relative bg-gradient-to-br from-blue-900 to-slate-900 text-white overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 relative z-10 text-center">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                        Manufacturers: Sell to <span className="text-blue-400">1,000+ Retailers</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
                        Directly connect with retailers. No middlemen. No listing fees.
                        We handle the sales, you handle the manufacturing.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all transform hover:scale-105 shadow-lg shadow-green-500/25"
                        >
                            <MessageSquare className="w-6 h-6" />
                            Start Selling on WhatsApp
                        </a>
                        <p className="text-sm text-gray-400 mt-2 sm:mt-0 opacity-80">
                            *Instant onboarding. No long forms.
                        </p>
                    </div>
                </div>
            </div>

            {/* Value Proposition Grid */}
            <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-16 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: <Package className="w-10 h-10 text-blue-500" />,
                            title: "Zero Dead Stock",
                            description: "Move your inventory faster by accessing our network of active retailers looking for bulk deals."
                        },
                        {
                            icon: <Truck className="w-10 h-10 text-purple-500" />,
                            title: "We Handle Logistics",
                            description: "Ship to us or directly to the retailer. We manage the courier coordination and tracking."
                        },
                        {
                            icon: <Smartphone className="w-10 h-10 text-green-500" />,
                            title: "WhatsApp First",
                            description: "Manage your catalog and receive orders directly via WhatsApp. No complex dashboards to learn."
                        }
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 hover:border-blue-100 transition-colors">
                            <div className="bg-gray-50 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                            <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works */}
            <div className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
                        <p className="text-gray-500 mt-2">Start selling in less than 5 minutes</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 hidden md:block z-0"></div>

                        {[
                            {
                                step: "01",
                                title: "Connect",
                                text: "Click the button below to message us on WhatsApp."
                            },
                            {
                                step: "02",
                                title: "Share Catalog",
                                text: "Send photos and wholesale prices of your products."
                            },
                            {
                                step: "03",
                                title: "Get Orders",
                                text: "We list your items. You receive orders instantly."
                            }
                        ].map((step, idx) => (
                            <div key={idx} className="relative z-10 bg-white p-6 rounded-xl text-center">
                                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6 shadow-lg shadow-blue-200">
                                    {step.step}
                                </div>
                                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                                <p className="text-gray-600">{step.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky Mobile CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:hidden z-50">
                <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95 transition-transform"
                >
                    <MessageSquare className="w-5 h-5" />
                    Start Selling Now
                </a>
            </div>

            {/* FAQ Section */}
            <div className="py-20 bg-gray-50">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
                    <div className="space-y-4">
                        {[
                            { q: "Do I need to pay any registration fee?", a: "No. Registration is completely free for manufacturers and importers." },
                            { q: "Who pays for shipping?", a: "Shipping costs are generally borne by the retailer, but we handle the logistics coordination." },
                            { q: "When do I get paid?", a: "Payments are processed within 24-48 hours of order delivery." }
                        ].map((faq, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    {faq.q}
                                </h3>
                                <p className="text-gray-600 pl-7">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
