'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Factory, Store, Mail, Lock, Building, Phone, MapPin, ArrowRight, Check } from 'lucide-react'

type UserType = 'manufacturer' | 'retailer'

const RegisterContent = () => {
    const searchParams = useSearchParams()
    const [userType, setUserType] = useState<UserType>('retailer')
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        business_name: '',
        phone: '',
        gst_number: '',
        city: '',
        state: '',
        address: '',
    })

    useEffect(() => {
        const type = searchParams.get('type')
        if (type === 'manufacturer' || type === 'retailer') {
            setUserType(type)
        }
    }, [searchParams])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            })

            if (authError) throw authError

            // 2. Create user profile
            const { error: profileError } = await (supabase.from('users') as any).insert({
                id: authData.user?.id,
                email: formData.email,
                user_type: userType,
                business_name: formData.business_name,
                phone: formData.phone,
                gst_number: formData.gst_number || null,
                city: formData.city,
                state: formData.state,
                address: formData.address,
                is_verified: false,
            })

            if (profileError) throw profileError

            toast.success('Registration successful!')

            // Redirect based on user type
            if (userType === 'manufacturer') {
                router.push('/manufacturer')
            } else {
                router.push('/products')
            }
        } catch (error: any) {
            toast.error(error.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    const updateForm = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-white py-12 px-4">
            <div className="max-w-lg w-full">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-xl">D2B</span>
                        </div>
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
                    <p className="text-gray-600 mt-2">Join D2BCart and start trading</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg">
                    {/* User Type Selection */}
                    <div className="flex gap-4 mb-8">
                        <button
                            type="button"
                            onClick={() => setUserType('retailer')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${userType === 'retailer'
                                ? 'border-emerald-600 bg-emerald-50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <Store className={`w-8 h-8 mx-auto mb-2 ${userType === 'retailer' ? 'text-emerald-600' : 'text-gray-400'
                                }`} />
                            <div className={`font-semibold ${userType === 'retailer' ? 'text-emerald-600' : 'text-gray-600'
                                }`}>
                                I'm a Retailer
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Buy products wholesale
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setUserType('manufacturer')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${userType === 'manufacturer'
                                ? 'border-emerald-600 bg-emerald-50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <Factory className={`w-8 h-8 mx-auto mb-2 ${userType === 'manufacturer' ? 'text-emerald-600' : 'text-gray-400'
                                }`} />
                            <div className={`font-semibold ${userType === 'manufacturer' ? 'text-emerald-600' : 'text-gray-600'
                                }`}>
                                I'm a Manufacturer
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Sell products to retailers
                            </div>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Step 1: Account Info */}
                        {step === 1 && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Business Name *
                                    </label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={formData.business_name}
                                            onChange={(e) => updateForm('business_name', e.target.value)}
                                            className="input pl-10"
                                            placeholder="Your Business Name"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address *
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => updateForm('email', e.target.value)}
                                            className="input pl-10"
                                            placeholder="you@example.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password *
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => updateForm('password', e.target.value)}
                                            className="input pl-10"
                                            placeholder="Min 6 characters"
                                            minLength={6}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone Number *
                                    </label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => updateForm('phone', e.target.value)}
                                            className="input pl-10"
                                            placeholder="+91 XXXXX XXXXX"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    className="w-full btn-primary flex items-center justify-center gap-2"
                                >
                                    Continue
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </>
                        )}

                        {/* Step 2: Business Details */}
                        {step === 2 && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        GST Number (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.gst_number}
                                        onChange={(e) => updateForm('gst_number', e.target.value)}
                                        className="input"
                                        placeholder="22AAAAA0000A1Z5"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            City *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => updateForm('city', e.target.value)}
                                            className="input"
                                            placeholder="City"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            State *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.state}
                                            onChange={(e) => updateForm('state', e.target.value)}
                                            className="input"
                                            placeholder="State"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Business Address *
                                    </label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => updateForm('address', e.target.value)}
                                            className="input pl-10 min-h-[80px]"
                                            placeholder="Full business address"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 btn-secondary"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                Create Account
                                                <Check className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
                            Sign In
                        </Link>
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
