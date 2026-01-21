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
        <footer className="bg-white border-t border-gray-200 pt-12 pb-24 md:pb-12">
            <div className="max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="relative">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <span className="text-white font-black text-xl tracking-tight">D</span>
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="font-extrabold text-xl text-gray-900 tracking-tight">D2B<span className="text-emerald-600">Cart</span></span>
                                <span className="text-[9px] text-gray-400 font-medium tracking-wider uppercase">B2B Marketplace</span>
                            </div>
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            India's leading B2B marketplace connecting retailers directly with verified manufacturers.
                        </p>
                        <div className="flex items-center gap-4 pt-2">
                            <SocialLink href="https://www.facebook.com/profile.php?id=61569202844764" icon={Facebook} />
                            <SocialLink href="https://www.instagram.com/d2b_cart/" icon={Instagram} />
                        </div>
                    </div>

                    {/* Support Column */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Support & Help</h3>
                        <ul className="space-y-3 text-sm text-gray-600">
                            {getSupportLinks().map((link, idx) => (
                                <li key={idx}>
                                    <Link href={link.href} className="hover:text-emerald-600 transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                            <li className="flex items-start gap-2 pt-2">
                                <Phone className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                                <a href="https://wa.me/917557777987" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 transition-colors font-medium">WhatsApp: +91 75577 77987</a>
                            </li>
                            <li className="flex items-start gap-2">
                                <Mail className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                                <a href="mailto:support@d2bcart.com" className="hover:text-emerald-600 transition-colors">support@d2bcart.com</a>
                            </li>
                            <li className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                                <span className="text-gray-600">Vaibhav Heritage Height, Sector 16, Greater Noida, Uttar Pradesh, 201009</span>
                            </li>
                        </ul>
                    </div>

                    {/* Quick Links (Dynamic) */}
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-4">
                            {userRole === 'manufacturer' ? 'Seller Tools' : userRole === 'admin' ? 'Admin Tools' : 'Quick Actions'}
                        </h3>
                        <ul className="space-y-3 text-sm text-gray-600">
                            {getQuickLinks().map((link, idx) => (
                                <li key={idx}>
                                    <Link href={link.href} className="hover:text-emerald-600 transition-colors flex items-center gap-2">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                            {!userRole && (
                                <li className="pt-2">
                                    <Link href="/sell" className="text-emerald-700 font-medium hover:text-emerald-800 transition-colors">
                                        Become a Seller →
                                    </Link>
                                </li>
                            )}
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
                    <div className="flex gap-4">
                        {/* Styled Payment Methods Container */}
                        <div className="flex items-center gap-4 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
                            {/* Visa */}
                            <img src="/payment-icons/visa.svg" alt="Visa" className="h-6 w-auto" />

                            {/* Mastercard */}
                            <img src="/payment-icons/mastercard.svg" alt="Mastercard" className="h-8 w-auto" />

                            {/* RuPay */}
                            <img src="/payment-icons/rupay.svg" alt="RuPay" className="h-5 w-auto" />

                            {/* UPI */}
                            <img src="/payment-icons/upi.svg" alt="UPI" className="h-6 w-auto" />
                        </div>
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
