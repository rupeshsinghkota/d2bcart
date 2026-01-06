'use client';

import { ArrowRight, CheckCircle2, MessageSquare, Package, Smartphone, Truck } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function SellerPage() {
    const whatsappNumber = '919117474683'; // Verified support number
    const whatsappMessage = encodeURIComponent('Hi, I am a supplier/wholesaler and I want to sell my products on d2bcart.');
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Hero Section */}
            <div className="relative bg-slate-900 text-white min-h-[70vh] flex items-center overflow-hidden">
                {/* Background Image - Optimized for Desktop */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/marketing/desktop-landscape-warehouse-hero.png"
                        alt="High-tech Warehouse"
                        fill
                        priority
                        className="object-cover opacity-40 scale-105 animate-slow-zoom"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10 text-left w-full">
                    <div className="max-w-2xl">
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
                            Scale Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">Distribution</span> Across India
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed font-light">
                            Join 500+ premium Wholesalers & Importers.
                            Connect with <span className="text-white font-semibold">1,000+ verified retailers</span> in every major city.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl text-xl font-bold transition-all shadow-2xl shadow-blue-500/40 hover:-translate-y-1"
                            >
                                <MessageSquare className="w-7 h-7" />
                                Start Onboarding
                                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                            </a>
                            <div className="flex items-center gap-4 text-gray-400">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                                            {i === 4 ? '+500' : 'S'}
                                        </div>
                                    ))}
                                </div>
                                <span className="text-sm font-medium">Trusted by leading importers</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Focus Bar - New for Desktop */}
            <div className="bg-white border-b border-gray-100 overflow-hidden py-6">
                <div className="max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar flex items-center gap-12 whitespace-nowrap opacity-60">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Target Categories:</span>
                    {["Premium Mobile Covers", "11D Tempered Glass", "Fast Chargers", "MagSafe Gadgets", "Premium Cables", "Smart Watches"].map((cat, i) => (
                        <div key={i} className="flex items-center gap-2 text-gray-900 font-semibold group cursor-default">
                            <CheckCircle2 className="w-5 h-5 text-blue-500 transition-transform group-hover:scale-110" />
                            {cat}
                        </div>
                    ))}
                </div>
            </div>

            {/* Value Proposition Grid */}
            <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-12 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {[
                        {
                            icon: <Package className="w-10 h-10 text-blue-500" />,
                            title: "Zero Dead Stock",
                            description: "Liquidate inventory faster by accessing 1,000+ storefronts active daily in Delhi, Mumbai, and Bangalore."
                        },
                        {
                            icon: <Truck className="w-10 h-10 text-purple-500" />,
                            title: "Doorstep Logistics",
                            description: "No cargo headachs. We pick up bulk cartons from your warehouse and handle the entire last-mile delivery."
                        },
                        {
                            icon: <Smartphone className="w-10 h-10 text-green-500" />,
                            title: "Importer Dashboard",
                            description: "View real-time demand and manage your bulk catalog via a simplified interface or directly through WhatsApp."
                        }
                    ].map((feature, idx) => (
                        <div key={idx} className="group bg-white p-10 rounded-[32px] shadow-2xl shadow-gray-200/50 border border-transparent hover:border-blue-100 transition-all hover:shadow-blue-500/5 hover:-translate-y-2">
                            <div className="bg-gray-50 group-hover:bg-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mb-8 transition-colors">
                                {feature.icon}
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                            <p className="text-gray-500 text-lg leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works - Desktop Enhanced */}
            <div className="py-24 bg-slate-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-600/5 -skew-x-12 translate-x-1/2"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
                        {/* Steps */}
                        <div className="flex-1 space-y-12">
                            <div>
                                <h2 className="text-4xl font-bold text-gray-900 mb-6">Onboarding Experience</h2>
                                <p className="text-gray-500 text-xl font-light">Join India's most efficient B2B supply chain in 3 simple steps.</p>
                            </div>
                            <div className="space-y-10">
                                {[
                                    {
                                        step: "01",
                                        title: "Connect Instant",
                                        text: "Start a conversation on WhatsApp. No registrations required to browse demand."
                                    },
                                    {
                                        step: "02",
                                        title: "Catalog Upload",
                                        text: "Share your product range and pricing. Our team verifies and lists within 4 hours."
                                    },
                                    {
                                        step: "03",
                                        title: "Go Live",
                                        text: "Your collection becomes visible to our entire retail network. Start shipping today."
                                    }
                                ].map((step, idx) => (
                                    <div key={idx} className="flex gap-8 group">
                                        <div className="w-16 h-16 bg-white border border-gray-100 text-blue-600 rounded-2xl flex flex-shrink-0 items-center justify-center text-2xl font-black shadow-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            {step.step}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold mb-3 text-gray-900">{step.title}</h3>
                                            <p className="text-gray-500 leading-relaxed text-lg max-w-md">{step.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Illustration */}
                        <div className="flex-1 w-full flex justify-center">
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-blue-500/20 rounded-[40px] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative bg-white rounded-[40px] p-4 shadow-2xl border border-gray-100 overflow-hidden transform group-hover:scale-[1.02] transition-transform">
                                    <Image
                                        src="/marketing/supply-chain-process.png"
                                        alt="Supply Chain Process"
                                        width={800}
                                        height={600}
                                        className="w-full h-auto rounded-[32px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Mobile CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-gray-100 md:hidden z-50">
                <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-500/20"
                >
                    <MessageSquare className="w-6 h-6" />
                    Start Onboarding Now
                </a>
            </div>

            {/* FAQ Section */}
            <div className="py-24 bg-white">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">Supplier FAQs</h2>
                        <p className="text-gray-500 text-lg">Everything you need to know about selling on D2BCart</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[
                            { q: "Is there an onboarding fee?", a: "No. Registration is 100% free for all verified manufacturers and importers." },
                            { q: "Who handles last-mile shipping?", a: "We do. You just pack the master carton, and we handle the rest." },
                            { q: "Payment settlement period?", a: "We process settlements within 48 hours of order confirmation by the retailer." },
                            { q: "Can I sell electronic gadgets?", a: "Yes, as long as you provide warranty support for technical issues." }
                        ].map((faq, idx) => (
                            <div key={idx} className="bg-gray-50 p-8 rounded-3xl border border-transparent hover:border-blue-100 transition-all">
                                <h3 className="font-bold text-xl mb-4 text-gray-900 leading-snug">
                                    {faq.q}
                                </h3>
                                <p className="text-gray-500 text-lg">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
