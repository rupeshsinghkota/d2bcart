'use client'

import React from 'react'
import { Building2, Target, Users, ShieldCheck, Globe, Trophy } from 'lucide-react'

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-emerald-900 text-white py-20 px-4 relative overflow-hidden">
                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6">Empowering Bharat's <br /><span className="text-emerald-400">Retail Ecosystem</span></h1>
                    <p className="text-xl text-emerald-100 max-w-3xl mx-auto leading-relaxed">
                        D2BCart is India's premier B2B marketplace, designed to bridge the gap between local retailers and verified manufacturers. We are on a mission to digitize the supply chain for 12 million+ Kirana stores and small businesses.
                    </p>
                </div>
                {/* Decorative background blobs */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </section>

            {/* Vision & Mission */}
            <section className="py-20 px-4">
                <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold uppercase tracking-wider">
                            Our Purpose
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Revolutionizing Direct-to-Business Commerce</h2>
                        <p className="text-gray-600 text-lg leading-relaxed">
                            At D2BCart, we believe that technology should empower traditional businesses, not replace them. By cutting out inefficient layers of distribution, we enable retailers to earn higher margins and manufacturers to reach wider markets with ease.
                        </p>
                        <div className="grid grid-cols-2 gap-6 pt-4">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="text-3xl font-bold text-emerald-600 mb-1">500+</div>
                                <div className="text-sm text-gray-500 font-medium">Verified Factories</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="text-3xl font-bold text-emerald-600 mb-1">10k+</div>
                                <div className="text-sm text-gray-500 font-medium">Active Retailers</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-emerald-50 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                        <div className="relative z-10 space-y-8">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                                    <Target className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Our Mission</h3>
                                    <p className="text-gray-600">To provide small businesses with the technology and tools they need to thrive in a competitive global market.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                                    <Globe className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Our Vision</h3>
                                    <p className="text-gray-600">To build the most trusted and efficient B2B logistics and commerce network for Bharat.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="py-20 bg-gray-50 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">The D2BCart Values</h2>
                        <p className="text-gray-600 font-medium">What drives us every single day</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: ShieldCheck,
                                title: "Trust First",
                                desc: "Transparency and security are at the core of every transaction we facilitate."
                            },
                            {
                                icon: Users,
                                title: "Retailer Obsessed",
                                desc: "We win when our retailers win. Every feature is built to solve their pain points."
                            },
                            {
                                icon: Trophy,
                                title: "Operating at Scale",
                                desc: "We are building for the long term, creating sustainable value for the ecosystem."
                            }
                        ].map((value, i) => (
                            <div key={i} className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-8">
                                    <value.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">{value.title}</h3>
                                <p className="text-gray-500 leading-relaxed">{value.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
