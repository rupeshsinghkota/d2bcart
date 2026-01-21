'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Phone, ArrowRight, Loader2 } from 'lucide-react'

export default function PhoneLogin() {
    const [phone, setPhone] = useState('')
    const [otp, setOtp] = useState('')
    const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const formatPhone = (input: string) => {
        // Simple formatter: Ensure +91 prefix for India if missing
        let cleaned = input.replace(/\D/g, '')
        if (cleaned.length === 10) {
            return `+91${cleaned}`
        }
        return `+${cleaned}`
    }

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const formattedPhone = formatPhone(phone)

        try {
            const { error } = await supabase.auth.signInWithOtp({
                phone: formattedPhone,
            })

            if (error) throw error

            toast.success('OTP sent successfully!')
            setStep('OTP')
        } catch (error: any) {
            console.error('OTP Error:', error)
            toast.error(error.message || 'Failed to send OTP')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (loading) return
        setLoading(true)

        const formattedPhone = formatPhone(phone)

        try {
            // 1. Verify OTP
            const { data, error } = await supabase.auth.verifyOtp({
                phone: formattedPhone,
                token: otp,
                type: 'sms',
            })

            if (error) throw error

            // 2. OTP Verified - Session is Active from here
            await handlePostLogin(data.user)

        } catch (otpError: any) {
            console.error('Verify Error:', otpError)

            // 3. Fallback: Check if we are actually logged in (Race condition / Double submit)
            // If the specific error is 'Token has expired or is invalid', it might mean it was just consumed.
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                console.log('Session exists despite OTP error (likely double submit). Proceeding.')
                await handlePostLogin(session.user)
                return
            }

            toast.error(otpError.message || 'Invalid OTP. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handlePostLogin = async (user: any) => {
        try {
            if (!user) return

            // Check if user exists in our users table
            const { data: profile } = await supabase
                .from('users')
                .select('user_type')
                .eq('id', user.id)
                .single() as { data: any }

            if (profile) {
                // Update global store logic here if needed
                try {
                    const { useStore } = await import('@/lib/store')
                    useStore.getState().setUser(profile as any)
                } catch (e) { }

                toast.success('Login successful!')

                // Smart Redirect
                if (profile.user_type === 'manufacturer') {
                    router.push('/wholesaler')
                } else if (profile.user_type === 'admin') {
                    router.push('/admin')
                } else {
                    router.push('/products')
                }
                router.refresh()
            } else {
                // Profile not found by ID. Check for "Orphaned" profile via API
                try {
                    const res = await fetch('/api/auth/link-account', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.id,
                            phone: formatPhone(phone) // Use state phone as fallback
                        })
                    })

                    if (res.ok) {
                        const linkData = await res.json()
                        if (linkData.success && linkData.status === 'migrated') {
                            toast.success('Account successfully linked! Logging you in...')
                            router.refresh()

                            const type = linkData.user_type
                            if (type === 'manufacturer') {
                                router.push('/wholesaler')
                            } else if (type === 'admin') {
                                router.push('/admin')
                            } else {
                                router.push('/products')
                            }
                            return
                        }
                    }
                } catch (e) {
                    console.error('Link check failed', e)
                    // Continue to register...
                }

                // If still new, redirect to register
                toast.success('Welcome! Please complete your profile.')
                router.push('/register?step=2')
            }
        } catch (postError) {
            console.error('Post-Login Logic Error:', postError)
            // Even if profile fetch fails, user is authenticated.
            // Send them to homepage or register to let them sort it out
            toast.success('Login verified. Redirecting...')
            router.push('/products')
            router.refresh()
        }
    }

    return (
        <div className="space-y-6">
            {step === 'PHONE' ? (
                <form onSubmit={handleSendOtp} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900">Phone Number</label>
                        <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                placeholder="+91 99999 99999"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-500">We'll send you a verification code on WhatsApp.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <>
                                Send WhatsApp OTP
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900">Enter OTP</label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-center text-2xl tracking-widest"
                            placeholder="000000"
                            maxLength={6}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setStep('PHONE')}
                        className="w-full text-sm text-gray-500 hover:text-gray-900"
                    >
                        Change Phone Number
                    </button>
                </form>
            )}
        </div>
    )
}
