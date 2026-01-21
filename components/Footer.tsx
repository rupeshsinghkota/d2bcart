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
        ]

        if (userRole === 'manufacturer') {
            return [
                ...commonDocs,
                { label: 'Seller Handbook', href: '#' },
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
                    <div className="flex gap-4 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                        {/* Build a visually pleasing placeholder for payment icons using CSS */}
                        <div className="flex gap-3 items-center grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                            {/* Visa */}
                            <svg className="h-6 w-auto" viewBox="0 0 50 32" xmlns="http://www.w3.org/2000/svg"><path fill="#1434CB" d="M18.5 2h3.5l-5.5 19h-3.5L18.5 2zm11.2 0h3.4l-2 19h-3.2l2-19h-0.2zM45 2h3l-2 19h-2.8l-1.8-10.8c-0.2-1.2-0.6-2.5-0.6-2.5h-0.2c0 0-0.4 1.3-0.8 2.5L37.8 21h-3.2L45 2zM12.5 13.8c-0.2-0.8-1.5-4.2-3-7.8l-1-2C8.2 3.2 7.8 2.5 7.2 2.2C6.8 2 4.2 2 4.2 2L4 3c0 0 4.2 1 5.2 3.2c0.2 0.5 1.5 6.5 2 8.5C11.5 15.8 12.2 18 12.5 13.8z" /><path fill="#FFF" d="M22 2h-3.5l5.5 19h3.5L22 2z" /></svg>

                            {/* Mastercard */}
                            <svg className="h-7 w-auto" viewBox="0 0 50 32" xmlns="http://www.w3.org/2000/svg"><g fill="none" fillRule="evenodd"><path fill="#FF5F00" d="M19.3 10.3c2.3 2.5 3.6 5.9 3.6 9.7s-1.3 7.2-3.6 9.7c-2.3-2.5-3.6-5.9-3.6-9.7s1.3-7.2 3.6-9.7" /><path fill="#EB001B" d="M22.9 20c0-3.8-1.3-7.2-3.6-9.7c-2.7-2.9-6.6-4.7-10.9-4.7C3.8 5.6 0 9.4 0 14.1s3.8 8.4 8.4 8.4c4.3 0 8.2-1.8 10.9-4.7c2.3-2.5 3.6-5.9 3.6-9.7" /><path fill="#F79E1B" d="M42 14.1c0 4.7-3.8 8.4-8.4 8.4c-4.3 0-8.2-1.8-10.9-4.7c-2.3-2.5-3.6-5.9-3.6-9.7s1.3-7.2 3.6-9.7c2.7-2.9 6.6-4.7 10.9-4.7c4.6 0 8.4 3.8 8.4 8.4" /></g></svg>

                            {/* RuPay */}
                            <svg className="h-4 w-auto" viewBox="0 0 100 32" xmlns="http://www.w3.org/2000/svg"><path fill="#1A3F78" d="M42.3 2h8.4l-4.5 11l4.8 12h-8.8l-1.8-5.2h-3.8l-2 5.2h-8.8l11-23h0.2l5.3 0zm-2.8 5.8l-1.8 5.2h3.5l-1.7-5.2zM27 2h8.5v16c0 4.2-2.5 6-6.2 6H20V2h7V2z m-1.2 16.5c1.2 0 2.2-0.8 2.2-2.5V7.5h-2.2v11zM65 2h8.5v16c0 4-2.5 6-6.2 6H58V2h7V2zm-1.2 16.5c1.2 0 2.2-0.8 2.2-2.5V7.5h-2.2v11zM85 9.5l-4.5 13.5h-8l-4.5-13.5h8.2l0.8 3.5l0.8-3.5h7.2z" /></svg>

                            {/* UPI */}
                            <svg className="h-8 w-auto" viewBox="0 0 100 32" xmlns="http://www.w3.org/2000/svg"><path fill="#666" d="M12 2L4 14h16l-8-12zm0 24c-6.6 0-12-5.4-12-12h24c0 6.6-5.4 12-12 12z" /></svg>
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
