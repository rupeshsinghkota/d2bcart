'use client'

import React, { useState } from 'react'
import { Mail, Phone, MapPin, Send, MessageSquare, Clock } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function ContactPage() {
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        // Simulate form submission
        await new Promise(resolve => setTimeout(resolve, 1000))
        toast.success("Message sent! We'll get back to you shortly.")
        setLoading(false)
        const form = e.target as HTMLFormElement
        form.reset()
    }

    return (
        <div className="min-h-screen bg-white">
            <section className="bg-emerald-900 py-16 px-4">
                <div className="max-w-7xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Contact Our Team</h1>
                    <p className="text-emerald-100 text-lg max-w-2xl mx-auto opacity-90">
                        Have questions about sourcing, selling, or shipping? We're here to help you scale your business.
                    </p>
                </div>
            </section>

            <section className="py-20 px-4">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-12">
                    {/* Contact Information */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-900">Get in Touch</h2>
                            <p className="text-gray-500">Reach out to us via any of these channels. Our business hours are Monday - Friday, 9:00 AM - 6:00 PM IST.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                                    <Phone className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">WhatsApp</div>
                                    <a href="https://wa.me/917557777987" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-emerald-600 transition-colors">+91 75577 77987</a>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                                    <Mail className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">Email</div>
                                    <a href="mailto:support@d2bcart.com" className="text-gray-600 hover:text-emerald-600 transition-colors">support@d2bcart.com</a>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                                    <MapPin className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">Corporate HQ</div>
                                    <p className="text-gray-600">Vaibhav Heritage Height, Sector 16, Greater Noida, Uttar Pradesh, 201009</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-gray-100 italic text-gray-400 text-sm flex gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Typically responds within 4-6 hours.</span>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="lg:col-span-2 bg-gray-50 rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-sm">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Full Name</label>
                                    <input required type="text" placeholder="Enter your name" className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-300" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Email Address</label>
                                    <input required type="email" placeholder="email@business.com" className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-300" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Subject</label>
                                <select required className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all">
                                    <option value="">Select an option</option>
                                    <option value="retailer">Retatiler Registration Help</option>
                                    <option value="manufacturer">Selling on D2BCart</option>
                                    <option value="delivery">Delivery & Logistics</option>
                                    <option value="payment">Payment & Payouts</option>
                                    <option value="other">Other Inquiry</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Message</label>
                                <textarea required rows={5} placeholder="How can we help you?" className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all resize-none placeholder:text-gray-300" />
                            </div>
                            <button
                                disabled={loading}
                                type="submit"
                                className="w-full md:w-auto px-10 py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/10 hover:bg-emerald-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                            >
                                {loading ? "Sending..." : "Send Message"}
                                <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    )
}
