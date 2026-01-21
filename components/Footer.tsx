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
                            <svg className="h-6 w-auto" viewBox="0 0 1000 323.6" xmlns="http://www.w3.org/2000/svg">
                                <g transform="matrix(4.43,0,0,4.43,-81.1,-105)">
                                    <polygon points="116.1,95.7 97.8,95.7 109.2,24.9 127.5,24.9" style={{ fill: '#00579f' }} />
                                    <path d="m 182.4,26.7 c -3.6,-1.4 -9.3,-3 -16.4,-3 -18,0 -30.7,9.6 -30.8,23.3 -0.1,10.1 9.1,15.8 16,19.1 7,3.4 9.4,5.7 9.4,8.8 0,4.7 -5.7,6.9 -10.9,6.9 -7.3,0 -11.2,-1.1 -17.1,-3.7 l -2.4,-1.1 -2.5,15.8 c 4.2,1.9 12.1,3.6 20.3,3.7 19.1,0 31.6,-9.4 31.8,-24.1 0,-8 -4.8,-14.2 -15.3,-19.2 -6.3,-3.2 -10.3,-5.4 -10.3,-8.7 0,-3 3.3,-6 10.5,-6 5.9,-0.1 10.3,1.2 13.6,2.7 l 1.6,0.7 2.4,-15.2 z" style={{ fill: '#00579f' }} />
                                    <path d="m 206.7,70.6 c 1.5,-4 7.3,-19.7 7.3,-19.7 1.5,-4.1 2.4,-6.7 2.4,-6.7 l 1.2,6.1 c 0,0 3.4,16.9 4.2,20.4 -2.8,0 -11.5,0 -15.2,0 z m 22.5,-45.6 h -14.1 c -4.3,0 -7.6,1.2 -9.5,5.8 l -27.1,64.8 h 19.1 c 0,0 3.1,-8.7 3.8,-10.6 h 23.4 c 0.5,2.4 2.1,10.6 2.1,10.6 h 16.9 l -14.7,-70.7 z" style={{ fill: '#00579f' }} />
                                    <path d="M 82.5,24.9 64.6,73.2 62.7,63.4 C 59.4,52.1 49,39.8 37.4,33.7 l 16.4,61.8 h 19.3 l 28.7,-70.6 H 82.5 z" style={{ fill: '#00579f' }} />
                                    <path d="m 48,24.9 h -29.4 l -0.3,1.4 c 22.9,5.8 38.1,20 44.3,37 l 13.7,-32.5 c -1,-4.5 -4.2,-5.7 -8.2,-5.9 z" style={{ fill: '#faa61a' }} />
                                </g>
                            </svg>

                            {/* Mastercard */}
                            <svg className="h-8 w-auto" viewBox="0 0 999.2 776" xmlns="http://www.w3.org/2000/svg">
                                <path style={{ fill: '#333' }} d="M181.1,774.3v-51.5c0-19.7-12-32.6-32.6-32.6c-10.3,0-21.5,3.4-29.2,14.6c-6-9.4-14.6-14.6-27.5-14.6h-73l18,82.4h18v-45.5c0-14.6,7.7-21.5,19.7-21.5s18,7.7,18,21.5v45.5h18z M448.1,691.9h-29.2V667h-18v24.9h-16.3v16.3h16.3v37.8c0,18.9,7.7,30,28.3,30c7.7,0,16.3-2.6,22.3-6l-5.2-15.5c-8.6,0-12-5.2-12-13.7v-36.9h29.2z M600.9,690.1c-10.3,0-17.2,5.2-21.5,12v-82.4h18v-46.4c0-13.7,6-21.5,17.2-21.5c3.4,0,7.7,0.9,11.2,1.7l5.2-17.2z" />
                                <rect x="364" y="66.1" fill="#FF5A00" width="270.4" height="485.8" />
                                <circle cx="309" cy="309" r="309" fill="#EB001B" opacity="0.9" />
                                <circle cx="690" cy="309" r="309" fill="#F79E1B" opacity="0.9" />
                            </svg>

                            {/* RuPay */}
                            <svg className="h-5 w-auto" viewBox="0 0 71.867 18.905" xmlns="http://www.w3.org/2000/svg">
                                <g id="layer1">
                                    <path style={{ fill: '#008c44' }} d="m 71.867,9.453 -4.053,8.046 -8.52 -8.05 z" />
                                    <path style={{ fill: '#f47920' }} d="m 69.038,9.453 -4.047,8.046 -8.513,-8.054 z" />
                                    <path style={{ fill: '#1b3281' }} d="M 0.016,14.573 4.058,0.011 H 10.52 c 2.019,0 3.367,-0.32 4.053,-0.978 0.681,-0.653 0.812,-1.72 0.402,-3.218 -0.248,-0.883 -0.626,-1.624 -1.144,-2.21 -0.514,-0.587 -1.192,-1.051 -2.028,-1.392 0.709,-0.17 1.159,-0.509 1.361,-1.016 0.201,-0.507 0.178,-1.247 -0.066,-2.217 l -2.484,-8.862 -0.001,-0.055 c -0.142,-0.57 -0.1,-0.875 0.131,-0.9 L 10.518,14.573 H 6.077 c 0.015,0.342 0.042,0.648 0.071,0.906 0.032,0.263 0.07,0.467 0.11,0.607 l 0.407,1.454 c 0.205,0.756 0.218,1.283 0.028,1.587 -0.192,0.312 -0.623,0.465 -1.302,0.465 H 5.689 L 4.289,14.573 Z m 6.584,8.301 h 1.967 c 0.689,0 1.198,0.098 1.511,0.302 0.315,0.205 0.549,0.552 0.686,1.054 0.142,0.51 0.107,0.866 -0.097,1.068 -0.203,0.205 -0.69,0.305 -1.456,0.305 H 7.371 Z" />
                                    <path style={{ fill: '#1b3281' }} d="m 26.966,3.831 -2.979,-10.744 H 20.37 l 0.445,1.574 c -0.637,-0.626 -1.289,-1.101 -1.946,-1.405 -0.652,-0.309 -1.34,-0.461 -2.064,-0.461 -0.599,0 -1.113,0.109 -1.527,0.324 -0.419,0.215 -0.731,0.542 -0.941,0.973 -0.186,0.377 -0.267,0.843 -0.236,1.4 -0.033,0.548 0.227,1.471 0.585,2.764 L 16.219,3.831 h 3.96 l -1.54,-5.549 c -0.225,-0.812 -0.279,-1.383 -0.169,-1.694 0.114,-0.314 0.419,-0.476 0.915,-0.476 0.499,0 0.918,0.181 1.265,0.549 0.351,0.365 0.623,0.911 0.826,1.636 l 1.229,4.425 z" />
                                    <path style={{ fill: '#1b3281' }} d="m 25.53,14.573 4.036,14.559 h 5.553 c 1.225,0 2.174,-0.072 2.85,-0.231 0.675,-0.152 1.204,-0.399 1.597,-0.747 0.493,-0.455 0.795,-1.019 0.919,-1.696 0.117,-0.676 0.048,-1.464 -0.208,-2.39 -0.495,-1.777 -1.288,-3.024 -2.417,-3.895 -1.134,-0.86 -2.536,-1.293 -4.21,-1.293 H 28.188 l -1.234,-4.437 z m 6.55,8.014 h 1.396 c 0.903,0 1.537,0.112 1.91,0.327 0.36,0.218 0.615,0.605 0.771,1.156 0.156,0.558 0.116,0.948 -0.12,1.166 -0.227,0.217 -0.806,0.327 -1.734,0.327 h -1.394 z" />
                                    <path style={{ fill: '#1b3281' }} d="m 44.935,14.573 0.04,1.02 c -0.638,-0.478 -1.285,-0.84 -1.935,-1.065 -0.648,-0.23 -1.337,-0.347 -2.075,-0.347 -1.122,0 -1.904,0.305 -2.356,0.895 -0.447,0.591 -0.52,1.44 -0.215,2.522 0.292,1.069 0.811,1.855 1.559,2.358 0.745,0.509 1.988,0.873 3.733,1.106 0.221,0.036 0.518,0.065 0.889,0.11 1.29,0.149 2.014,0.493 2.17,1.054 0.081,0.307 0.032,0.534 -0.159,0.673 -0.184,0.144 -0.527,0.215 -1.024,0.215 -0.412,0 -0.743,-0.085 -1.015,-0.263 -0.271,-0.179 -0.474,-0.441 -0.611,-0.81 h -3.861 c 0.349,1.21 1.061,2.124 2.13,2.735 1.066,0.622 2.471,0.921 4.21,0.921 0.818,0 1.551,-0.077 2.199,-0.243 0.649,-0.159 1.123,-0.386 1.431,-0.66 0.378,-0.343 0.602,-0.733 0.666,-1.165 0.074,-0.431 -0.007,-1.048 -0.233,-1.856 L 48.818,15.781 c -0.053,-0.196 -0.063,-0.371 -0.034,-0.53 0.035,-0.152 0.101,-0.282 0.218,-0.374 l -0.089,-0.304 z m 0.963,4.797 c -0.421,-0.169 -0.968,-0.331 -1.648,-0.509 -1.067,-0.286 -1.666,-0.598 -1.796,-1.07 -0.09,-0.304 -0.054,-0.538 0.094,-0.716 0.146,-0.169 0.401,-0.254 0.759,-0.254 0.657,0 1.185,0.166 1.579,0.494 0.394,0.332 0.689,0.854 0.895,1.574 0.036,0.153 0.068,0.263 0.088,0.345 z" />
                                    <path style={{ fill: '#1b3281' }} d="m 48.941,18.806 0.879,3.18 h 1.133 c 0.379,0 0.677,0.075 0.888,0.211 0.214,0.141 0.36,0.38 0.444,0.701 0.042,0.141 0.068,0.29 0.085,0.459 0.011,0.179 0.011,0.369 0,0.588 l -0.613,9.45 h 4.009 l -0.062,-6.518 3.5,6.518 h 3.728 L 56.748,23.093 c -0.702,-1.195 -1.212,-2.016 -1.536,-2.464 -0.32,-0.442 -0.624,-0.786 -0.919,-1.019 -0.382,-0.322 -0.808,-0.55 -1.268,-0.683 -0.461,-0.133 -1.163,-0.201 -2.107,-0.201 -0.272,0 -0.584,0.005 -0.922,0.023 -0.322,-0.083 -0.681,-0.063 -1.055,0.017" />
                                </g>
                            </svg>

                            {/* UPI */}
                            <svg className="h-6 w-auto" viewBox="0 0 130.54 46.118" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <clipPath id="clipPath28" clipPathUnits="userSpaceOnUse"><path d="M 0,216 H 432 V 0 H 0 Z" /></clipPath>
                                </defs>
                                <g transform="matrix(0.3527,0,0,-0.3527,-10.92,61.15)">
                                    <g clipPath="url(#clipPath28)">
                                        <g style={{ fill: '#69696a' }}>
                                            <path d="M 33.9,61 h 2.7 l -2.5,-10.7 c -0.3,-1.5 -0.3,-2.7 0.2,-3.5 0.5,-0.8 1.5,-1.2 2.9,-1.2 1.4,0 2.5,0.4 3.4,1.2 0.9,0.8 1.5,2 1.9,3.5 L 45.3,61 h 2.8 l -2.6,-11 c -0.5,-2.3 -1.5,-4.1 -3,-5.3 -1.4,-1.1 -3.3,-1.7 -5.7,-1.7 -2.3,0 -4,0.5 -4.8,1.7 -0.8,1.1 -1,2.9 -0.4,5.3 z" />
                                            <path d="M 47.7,43.3 52.1,61.7 60.5,50.9 c 0.2,-0.3 0.4,-0.6 0.6,-0.9 0.2,-0.3 0.4,-0.7 0.6,-1.1 l 2.9,12.2 h 2.5 L 63,-0.6 54.4,10.3 c -0.2,0.2 -0.4,0.6 -0.6,0.9 -0.1,0.3 -0.3,0.6 -0.5,1 l -2.9,-12.3 z" />
                                            <path d="M 67.2,43.3 71.4,61 h 2.8 l -4.2,-17.7 z" />
                                            <path d="M 74,43.3 78.2,61 h 9.6 l -1, -2.4 H 80.5 l -1,-4.4 h 6.8 l -0.6,-2.5 h -6.8 l -1.9,-8.3 z" />
                                            <path d="M 86.7,43.3 91,61 h 2.8 L 89.5,43.3 z" />
                                            <path d="M 93.6,43.3 97.8,61 h 9.6 l -1,-2.4 H 100 l -1,-4.4 h 6.8 l -0.6,-2.5 h -6.8 l -1.3,-5.7 h 6.8 L 103,43.3 z" />
                                            <path d="M 109.8,45.9 h 2.3 c 1.2,0 2.2,0 2.9,0.2 0.6,0.1 1.3,0.4 1.9,0.8 0.7,0.5 1.4,1.2 1.9,2.1 0.5,0.8 0.9,1.8 1.2,2.9 0.2,1.1 0.3,2.1 0.2,2.9 -0.1,0.8 -0.4,1.5 -0.9,2.1 -0.3,0.4 -0.8,0.7 -1.5,0.8 -0.6,0.1 -1.6,0.2 -3.1,0.2 h -2.3 l -1, -2.6 -3.4,17.7 h 3.7 c 2.4,0 4.1,-0.1 5.1,-0.3 0.9,-0.2 1.7,-0.6 2.3,-1.2 0.8,-0.7 1.3,-1.7 1.5,-3 0.2,-1.2 0.1,-2.6 -0.2,-4.2 -0.3,-1.5 -0.9,-2.9 -1.7,-4.1 -0.8,-1.2 -1.8,-2.2 -2.9,-3 -0.8,-0.5 -1.8,-1 -2.8,-1.2 -1,-0.2 -2.5,-0.3 -4.5,-0.3 h -0.7 z" />
                                        </g>
                                        <path style={{ fill: '#27803b' }} d="m 376.5,173 24.4,-48.5 -51.3,-48.5 z" />
                                        <path style={{ fill: '#e9661c' }} d="m 359.4,173 24.3,-48.5 -51.3,-48.5 z" />
                                        <path style={{ fill: '#66686c' }} d="m 306.4,170.2 c -1.3,1.8 -3.3,2.7 -6.2,2.7 h -106 l -5.2,-18.9 h 19.2 v 0 h 77.1 l -5.6,-20.2 H 202.5 l 0,0 h -19.2 l -16,-57.7 h 19.2 l 10.7,38.7 H 284 c 2.7,0 5.2,0.9 7.6,2.7 2.3,1.8 3.9,4.1 4.7,6.8 l 5.3,19 c 0.7,2.8 0.5,5.1 -0.8,6.9" />
                                    </g>
                                </g>
                            </svg>
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
