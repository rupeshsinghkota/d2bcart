'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, ShieldCheck, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Footer() {
    const currentYear = new Date().getFullYear()
    const [userRole, setUserRole] = useState<'retailer' | 'manufacturer' | 'admin' | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('user_type')
                    .eq('id', user.id)
                    .single()

                if (profile) {
                    setUserRole((profile as any).user_type)
                }
            }
        } catch (error) {
            console.error('Error fetching user role for footer:', error)
        } finally {
            setLoading(false)
        }
    }

    // Role-based link configurations
    const getQuickLinks = () => {
        if (!userRole) { // Guest
            return [
                { label: 'Browse Products', href: '/products' },
                { label: 'Login', href: '/login' },
                { label: 'Register as Retailer', href: '/register?type=retailer' },
                { label: 'Sell on D2BCart', href: '/sell' },
            ]
        }

        switch (userRole) {
            case 'manufacturer':
                return [
                    { label: 'Dashboard', href: '/manufacturer' },
                    { label: 'My Products', href: '/manufacturer/products' },
                    { label: 'Orders Received', href: '/manufacturer/orders' },
                    { label: 'Create Listing', href: '/manufacturer/products/add' },
                ]
            case 'admin':
                return [
                    { label: 'Admin Dashboard', href: '/admin' },
                    { label: 'Manage Users', href: '/admin/users' },
                    { label: 'Platform Reports', href: '/admin/reports' },
                    { label: 'Category Management', href: '/admin/categories' },
                ]
            case 'retailer':
            default:
                return [
                    { label: 'Browse Products', href: '/products' },
                    { label: 'My Orders', href: '/retailer/orders' },
                    { label: 'Wishlist', href: '/wishlist' },
                    { label: 'Profile Settings', href: '/retailer' },
                ]
        }
    }

    const getSupportLinks = () => {
        const commonDocs = [
            { label: 'About Us', href: '/about' },
            { label: 'Contact Us', href: '/contact' },
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
        ]

        if (userRole === 'manufacturer') {
            return [
                ...commonDocs,
                { label: 'Shipping Policy', href: '/shipping-policy' },
            ]
        }

        return [
            ...commonDocs,
            { label: 'Returns & Refunds', href: '/refund-policy' },
            { label: 'Shipping Policy', href: '/shipping-policy' },
        ]
    }

    return (
        <footer className="bg-white border-t border-gray-200 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                                <span className="font-bold text-lg">D</span>
                            </div>
                            <span className="font-bold text-xl text-gray-900">D2BCart</span>
                        </Link>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            Your trusted B2B marketplace connecting retailers directly with top manufacturers. Shop with confidence and ease.
                        </p>
                        <div className="flex gap-4 pt-2">
                            <a href="https://www.facebook.com/profile.php?id=61569202844764" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 rounded-full text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <Facebook size={18} />
                            </a>
                            <a href="https://www.instagram.com/d2b_cart/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 rounded-full text-gray-600 hover:bg-pink-50 hover:text-pink-600 transition-colors">
                                <Instagram size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4 text-sm tracking-wider uppercase">Quick Links</h3>
                        <ul className="space-y-3">
                            {getQuickLinks().map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-gray-600 hover:text-emerald-600 transition-colors text-sm">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Customer Support */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4 text-sm tracking-wider uppercase">Customer Support</h3>
                        <ul className="space-y-3">
                            {getSupportLinks().map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-gray-600 hover:text-emerald-600 transition-colors text-sm">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4 text-sm tracking-wider uppercase">Contact Us</h3>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                                <span className="text-gray-600 text-sm">
                                    Vaibhav Heritage Height, Sector 16,<br />
                                    Greater Noida, Uttar Pradesh, 201009
                                </span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                                <a href="tel:+917557777987" className="text-gray-900 font-medium hover:text-emerald-600 transition-colors">
                                    +91-7557777987
                                </a>
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail className="w-5 h-5 text-emerald-600 shrink-0" />
                                <a href="mailto:support@d2bcart.com" className="text-gray-600 text-sm hover:text-emerald-600 transition-colors">
                                    support@d2bcart.com
                                </a>
                            </li>
                        </ul>

                        {/* Trust Badge */}
                        <div className="mt-6 flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            <div>
                                <p className="text-xs font-semibold text-emerald-800">100% Secure Payments</p>
                                <p className="text-[10px] text-emerald-600">Encrypted & Safe Transactions</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-sm text-gray-500 order-2 md:order-1 text-center md:text-left">
                        © {currentYear} D2BCart. All rights reserved.
                    </p>

                    <div className="flex items-center gap-3 order-1 md:order-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                        <img src="/payment-icons/visa.svg" alt="Visa" className="h-5 w-auto" />
                        <img src="/payment-icons/mastercard.svg" alt="Mastercard" className="h-7 w-auto" />
                        <img src="/payment-icons/rupay.svg" alt="RuPay" className="h-4 w-auto" />
                        <img src="/payment-icons/upi.svg" alt="UPI" className="h-5 w-auto" />
                    </div>
                </div>
            </div>
        </footer>
    )
}
