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
        <div className="min-h-screen flex bg-white">
            {/* ... Left Side ... */}

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 lg:px-24 py-12 bg-white h-screen overflow-y-auto">
                <div className="w-full max-w-lg mx-auto">
                    {/* ... (Header) ... */}

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-emerald-500' : 'bg-gray-100'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-emerald-500' : 'bg-gray-100'}`}></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {step === 1 && !isProfileCompletion && (
                            <div className="animate-fade-in space-y-6">
                                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <h3 className="font-semibold text-emerald-900 mb-2">Mobile Verification</h3>
                                    <p className="text-sm text-emerald-600 mb-6">We use WhatsApp OTP for secure and instant verification.</p>
                                    {/* Phone Login Component handles the auth flow */}
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100/50">
                                        <PhoneLogin />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Business & Profile Details */}
                        {step === 2 && (
                            <div className="animate-fade-in space-y-6">
                                <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Complete Profile</h3>

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
                                            Complete Profile & Start
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
            </div >
        </div >
    )
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <RegisterContent />
        </Suspense>
    )
}
