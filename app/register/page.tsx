'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Factory, Store, Mail, Lock, Building, Phone, MapPin, ArrowRight, Check, ChevronLeft, Briefcase } from 'lucide-react'

type UserType = 'manufacturer' | 'retailer'

const RegisterContent = () => {
    const searchParams = useSearchParams()
    const [userType, setUserType] = useState<UserType>('retailer')
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const [formData, setFormData] = useState({
        user_type: 'retailer', // Default
        email: '',
        password: '',
        business_name: '',
        phone: '',
        gst_number: '',
        city: '',
        state: '',
        pincode: '',
        address: '',
    })

    useEffect(() => {
        const type = searchParams.get('type')
        if (type === 'manufacturer' || type === 'retailer') {
            setUserType(type)
            setFormData(prev => ({ ...prev, user_type: type }))
        }
    }, [searchParams])

    // Keep formData synced with local userType state change
    useEffect(() => {
        setFormData(prev => ({ ...prev, user_type: userType }))
    }, [userType])

    const updateForm = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Call API to create user (Bypasses RLS)
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed')
            }

            // Auto-login after successful registration
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            })

            if (loginError) {
                toast.success('Registration successful! Please login.')
                router.push('/login')
            } else {
                toast.success('Registration successful!')
                // Redirect based on user type
                if (userType === 'manufacturer') {
                    router.push('/wholesaler')
                } else {
                    router.push('/products')
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side - Brand/Image */}
            <div className="hidden lg:flex w-1/2 bg-emerald-900 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1569&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
                <div className="relative z-10 p-12 text-center text-white max-w-lg">
                    <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-emerald-900/50">
                        <span className="text-white font-bold text-3xl">D2B</span>
                    </div>
                    <h1 className="text-4xl font-bold mb-6 leading-tight">Join the Future of B2B Commerce</h1>
                    <p className="text-lg text-emerald-100 leading-relaxed mb-8">
                        Connect, trade, and grow your business with our secure and efficient digital marketplace.
                    </p>

                    {/* Testimonial or Stat */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-left border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex -space-x-2">
                                <div className="w-8 h-8 rounded-full bg-yellow-400 border-2 border-emerald-900"></div>
                                <div className="w-8 h-8 rounded-full bg-blue-400 border-2 border-emerald-900"></div>
                                <div className="w-8 h-8 rounded-full bg-pink-400 border-2 border-emerald-900"></div>
                            </div>
                            <span className="text-sm font-medium text-emerald-50">Trusted by 10,000+ businesses</span>
                        </div>
                        <p className="italic text-emerald-100 text-sm">"D2BCart transformed how we source products. The efficiency is unmatched."</p>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 lg:px-24 py-12 bg-white h-screen overflow-y-auto">
                <div className="w-full max-w-lg mx-auto">
                    {/* Mobile Logo */}
                    <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-8">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                            <span className="text-white font-bold text-lg">D2B</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">D2BCart</span>
                    </Link>

                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
                        <p className="text-gray-600">Start your journey with D2BCart today</p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-emerald-500' : 'bg-gray-100'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-emerald-500' : 'bg-gray-100'}`}></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Step 1: User Type & Account Info */}
                        {step === 1 && (
                            <div className="animate-fade-in space-y-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-gray-900">I am a</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setUserType('retailer')}
                                            className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left group ${userType === 'retailer'
                                                ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600/20'
                                                : 'border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${userType === 'retailer' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500'}`}>
                                                <Store className="w-5 h-5" />
                                            </div>
                                            <div className={`font-bold ${userType === 'retailer' ? 'text-emerald-900' : 'text-gray-700'}`}>Retailer</div>
                                            <div className="text-xs text-gray-500 mt-1">Buy products wholesale</div>
                                            {userType === 'retailer' && <div className="absolute top-4 right-4 text-emerald-600"><Check className="w-5 h-5" /></div>}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setUserType('manufacturer')}
                                            className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left group ${userType === 'manufacturer'
                                                ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600/20'
                                                : 'border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30'
                                                }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${userType === 'manufacturer' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500'}`}>
                                                <Factory className="w-5 h-5" />
                                            </div>
                                            <div className={`font-bold ${userType === 'manufacturer' ? 'text-emerald-900' : 'text-gray-700'}`}>Wholesaler</div>
                                            <div className="text-xs text-gray-500 mt-1">Sell to retailers</div>
                                            {userType === 'manufacturer' && <div className="absolute top-4 right-4 text-emerald-600"><Check className="w-5 h-5" /></div>}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-900">Business Name</label>
                                        <div className="relative group">
                                            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <input
                                                type="text"
                                                value={formData.business_name}
                                                onChange={(e) => updateForm('business_name', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                                placeholder="Enter business name"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-900">Email Address</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => updateForm('email', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                                placeholder="name@company.com"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-900">Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <input
                                                type="password"
                                                value={formData.password}
                                                onChange={(e) => updateForm('password', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                                placeholder="Create a password"
                                                minLength={6}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-900">Phone Number</label>
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => updateForm('phone', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                                placeholder="+91 99999 99999"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Step 2: Business Details */}
                        {step === 2 && (
                            <div className="animate-fade-in space-y-6">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-2"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Back to Account Info
                                </button>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-900">GST Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                                        <input
                                            type="text"
                                            value={formData.gst_number}
                                            onChange={(e) => updateForm('gst_number', e.target.value)}
                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                            placeholder="22AAAAA0000A1Z5"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-gray-900">City</label>
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => updateForm('city', e.target.value)}
                                                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                                placeholder="City"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-gray-900">State</label>
                                            <input
                                                type="text"
                                                value={formData.state}
                                                onChange={(e) => updateForm('state', e.target.value)}
                                                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                                placeholder="State"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-900">Pincode</label>
                                        <input
                                            type="text"
                                            value={formData.pincode}
                                            onChange={(e) => {
                                                // Only allow numbers and max 6 chars
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                                                updateForm('pincode', val)
                                            }}
                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium font-mono"
                                            placeholder="110001"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-900">Business Address</label>
                                        <div className="relative group">
                                            <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <textarea
                                                value={formData.address}
                                                onChange={(e) => updateForm('address', e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium min-h-[120px] resize-none"
                                                placeholder="Full street address, building, etc."
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Create Account
                                            <Check className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-gray-500 text-sm">
                            Already have an account?{' '}
                            <Link href="/login" className="text-emerald-600 font-bold hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <RegisterContent />
        </Suspense>
    )
}
