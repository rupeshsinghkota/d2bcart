'use client'

import React from 'react'
import Link from 'next/link'
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin, ShieldCheck, Heart, Package } from 'lucide-react'

export default function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="bg-white border-t border-gray-200 pt-12 pb-20 md:pb-12">
            <div className="max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
                                <span className="font-bold text-xl">D</span>
                            </div>
                            <span className="font-bold text-xl text-gray-900 tracking-tight">D2BCart</span>
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            India's leading B2B marketplace connecting retailers directly with verified manufacturers.
                        </p>
                        <div className="flex items-center gap-4 pt-2">
                            <SocialLink href="#" icon={Facebook} />
                            <SocialLink href="#" icon={Twitter} />
                            <SocialLink href="#" icon={Instagram} />
                            <SocialLink href="#" icon={Linkedin} />
                        </div>
                    </div>

                    {/* Support Column */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Support & Help</h3>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li>
                                <Link href="/help" className="hover:text-emerald-600 transition-colors">Help Center</Link>
                            </li>
                            <li className="flex items-start gap-2">
                                <Phone className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                                <a href="tel:+919876543210" className="hover:text-emerald-600 transition-colors">+91 98765 43210</a>
                            </li>
                            <li className="flex items-start gap-2">
                                <Mail className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                                <a href="mailto:support@d2bcart.com" className="hover:text-emerald-600 transition-colors">support@d2bcart.com</a>
                            </li>
                            <li>
                                <Link href="/returns" className="hover:text-emerald-600 transition-colors">Returns & Refunds</Link>
                            </li>
                            <li>
                                <Link href="/shipping-policy" className="hover:text-emerald-600 transition-colors">Shipping Policy</Link>
                            </li>
                        </ul>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li>
                                <Link href="/products" className="hover:text-emerald-600 transition-colors flex items-center gap-2">
                                    Browse Products
                                </Link>
                            </li>
                            <li>
                                <Link href="/retailer/orders" className="hover:text-emerald-600 transition-colors flex items-center gap-2">
                                    My Orders
                                </Link>
                            </li>
                            <li>
                                <Link href="/wishlist" className="hover:text-emerald-600 transition-colors flex items-center gap-2">
                                    Saved Items
                                </Link>
                            </li>
                            <li>
                                <Link href="/register?type=manufacturer" className="hover:text-emerald-600 transition-colors text-emerald-700 font-medium">
                                    Become a Seller
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal & Trust */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li>
                                <Link href="/terms" className="hover:text-emerald-600 transition-colors">Terms of Service</Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link>
                            </li>
                            <li>
                                <Link href="/gst-info" className="hover:text-emerald-600 transition-colors">GST Information</Link>
                            </li>
                        </ul>
                        <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm mb-1">
                                <ShieldCheck className="w-4 h-4" />
                                <span>100% Secure Payments</span>
                            </div>
                            <p className="text-xs text-emerald-600/80">
                                We ensure secure payment processing for all B2B transactions.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-8 mt-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500">
                        © {currentYear} D2BCart. All rights reserved.
                    </p>
                    <div className="flex gap-4 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                        {/* Placeholder Payment Icons */}
                        <div className="h-6 w-10 bg-gray-200 rounded"></div>
                        <div className="h-6 w-10 bg-gray-200 rounded"></div>
                        <div className="h-6 w-10 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        </footer>
    )
}

function SocialLink({ href, icon: Icon }: { href: string, icon: any }) {
    return (
        <a
            href={href}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all duration-300"
        >
            <Icon className="w-4 h-4" />
        </a>
    )
}
