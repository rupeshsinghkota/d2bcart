'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Factory, Store, Mail, Lock, Building, Phone, MapPin, ArrowRight, Check, ChevronLeft, Briefcase } from 'lucide-react'
import PhoneLogin from '@/components/auth/PhoneLogin'

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

    const [paramType] = useState(searchParams.get('type')) // Store initial param to avoid loop
    const [isProfileCompletion, setIsProfileCompletion] = useState(false)
    const [sessionLoading, setSessionLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(null)

    // Check for existing session (Phone Auth User)
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user) {
                    // Check if they already have a profile
                    const { data: profile } = await supabase
                        .from('users')
                        .select('id')
                        .eq('id', session.user.id)
                        .single()

                    if (!profile) {
                        // User exists but no profile -> Complete Profile Mode
                        setIsProfileCompletion(true)
                        setUserId(session.user.id)
                        if (session.user.phone) {
                            setFormData(prev => ({ ...prev, phone: session.user.phone! }))
                        }
                        setStep(2) // Skip directly to business details
                    }
                }
            } catch (e) {
                console.error('Session check failed', e)
            } finally {
                setSessionLoading(false)
            }
        }
        checkSession()
    }, [])

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
            let res;

            if (isProfileCompletion && userId) {
                // Call Complete Profile API
                res = await fetch('/api/register/complete-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...formData, userId })
                })
            } else {
                // Standard Registration
                res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
            }

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed')
            }

            if (!isProfileCompletion) {
                // Only try to login if it was a standard registration (which creates the auth user)
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password
                })

                if (loginError) {
                    toast.success('Registration successful! Please login.')
                    router.push('/login')
                    return // Stop here
                }
            }

            toast.success('Profile setup successful!')
            // Redirect based on user type
            if (userType === 'manufacturer') {
                router.push('/wholesaler')
            } else {
                router.push('/products')
            }

        } catch (error: any) {
            toast.error(error.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    if (sessionLoading) {
        return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div></div>
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        Join D2BCart
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        The ultimate B2B marketplace for retailers and manufacturers
                    </p>
                </div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-[520px]">
                <div className="bg-white py-8 px-4 sm:rounded-2xl sm:px-10 shadow-xl border border-gray-100">

                    {/* Progress Indicator */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                            <span className={step >= 1 ? 'text-emerald-600' : ''}>Verify Mobile</span>
                            <span className={step >= 2 ? 'text-emerald-600' : ''}>Business Details</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                            <div className={`h-full bg-emerald-500 transition-all duration-500 ease-out ${step === 1 ? 'w-1/2' : 'w-full'}`} />
                        </div>
                    </div>

                    {/* Step 1: Phone Authentication */}
                    {step === 1 && !isProfileCompletion && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 mb-6">
                                <h3 className="flex items-center gap-2 font-semibold text-emerald-900 mb-1">
                                    <Phone className="w-4 h-4" />
                                    Mobile Verification
                                </h3>
                                <p className="text-xs text-emerald-700 leading-relaxed">
                                    We use WhatsApp OTP for a secure, instant, and password-less login experience.
                                </p>
                            </div>

                            <div className="bg-white">
                                <PhoneLogin />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Business & Profile Details */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-gray-900">
                                    I am a...
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setUserType('retailer')}
                                        className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${userType === 'retailer'
                                            ? 'border-emerald-600 bg-emerald-50/50'
                                            : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${userType === 'retailer' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <Store className="w-5 h-5" />
                                        </div>
                                        <span className={`font-bold text-sm ${userType === 'retailer' ? 'text-emerald-900' : 'text-gray-700'}`}>Retailer</span>
                                        {userType === 'retailer' && <div className="absolute top-2 right-2 text-emerald-600"><Check className="w-4 h-4" /></div>}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setUserType('manufacturer')}
                                        className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200 ${userType === 'manufacturer'
                                            ? 'border-emerald-600 bg-emerald-50/50'
                                            : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${userType === 'manufacturer' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <Factory className="w-5 h-5" />
                                        </div>
                                        <span className={`font-bold text-sm ${userType === 'manufacturer' ? 'text-emerald-900' : 'text-gray-700'}`}>Wholesaler</span>
                                        {userType === 'manufacturer' && <div className="absolute top-2 right-2 text-emerald-600"><Check className="w-4 h-4" /></div>}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Name / Business Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Briefcase className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.business_name}
                                            onChange={(e) => updateForm('business_name', e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-shadow"
                                            placeholder="Enter your name or business name"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        GST Number <span className="text-gray-400 font-normal text-xs">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.gst_number}
                                        onChange={(e) => updateForm('gst_number', e.target.value)}
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                                        placeholder="22AAAAA0000A1Z5"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => updateForm('city', e.target.value)}
                                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                                            placeholder="City"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                        <input
                                            type="text"
                                            value={formData.state}
                                            onChange={(e) => updateForm('state', e.target.value)}
                                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                                            placeholder="State"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                    <input
                                        type="text"
                                        value={formData.pincode}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                                            updateForm('pincode', val)
                                        }}
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm font-mono tracking-wide"
                                        placeholder="110001"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                                    <div className="relative">
                                        <div className="absolute top-3 left-3 pointer-events-none">
                                            <MapPin className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => updateForm('address', e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm min-h-[100px] resize-none"
                                            placeholder="Street address, building, landmark etc."
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Complete Registration
                                        <ArrowRight className="w-4 h-4" />
                                    </span>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center border-t border-gray-100 pt-6">
                        <p className="text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link href="/login" className="font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
                                Sign in
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
