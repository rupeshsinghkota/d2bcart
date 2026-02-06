'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import PhoneLogin from '@/components/auth/PhoneLogin'

export default function LoginPage() {
    const [loginMethod, setLoginMethod] = useState<'EMAIL' | 'PHONE'>('PHONE')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isMagicLink, setIsMagicLink] = useState(false)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isMagicLink) {
                // Magic Link Login
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                })
                if (error) throw error
                toast.success('Check your email for the login link!')
            } else {
                // Password Login
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })

                if (error) throw error

                // Get user profile to determine redirect
                const { data: profile } = await supabase
                    .from('users')
                    .select('user_type')
                    .eq('id', data.user.id)
                    .single() as { data: { user_type: string } | null, error: any }

                if (profile) {
                    // Update global store immediately
                    const { useStore } = await import('@/lib/store')
                    useStore.getState().setUser(profile as any)

                    toast.success('Login successful!')

                    // Redirect based on user type
                    if (profile.user_type === 'manufacturer') {
                        router.push('/wholesaler')
                    } else if (profile.user_type === 'admin' || email === 'rupeshsingh1103@gmail.com') {
                        router.push('/admin')
                    } else {
                        router.push('/products')
                    }
                } else if (email === 'rupeshsingh1103@gmail.com') {
                    // Admin login successful but no profile record exists
                    toast.success('Admin Login successful!')
                    router.push('/admin')
                } else {
                    // Auth exists but no profile -> Redirect to completion
                    toast('Please complete your profile details.', { icon: '📝' })
                    router.push('/register?step=2')
                }
                router.refresh()
            }

        } catch (error: any) {
            toast.error(error.message || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side - Brand/Image */}
            <div className="hidden lg:flex w-1/2 bg-emerald-900 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1567&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
                <div className="relative z-10 p-12 text-center text-white max-w-lg">
                    <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-emerald-900/50">
                        <span className="text-white font-bold text-3xl">D2B</span>
                    </div>
                    <h1 className="text-4xl font-bold mb-6 leading-tight">Empowering B2B Trade with Simplicity</h1>
                    <p className="text-lg text-emerald-100 leading-relaxed">
                        The bridge between Bharat's manufacturers and retailers. Source at factory rates or scale your production by selling to 10k+ businesses.
                    </p>
                </div>
                {/* Decorative circles */}
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500 rounded-full blur-3xl opacity-20"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-400 rounded-full blur-3xl opacity-20"></div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 lg:px-24 py-12 bg-white">
                <div className="w-full max-w-md mx-auto">
                    {/* Mobile Logo */}
                    <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-10">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                            <span className="text-white font-bold text-lg">D2B</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">D2BCart</span>
                    </Link>

                    <div className="mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome Back</h2>
                        <p className="text-gray-600">Please enter your details to sign in</p>
                    </div>

                    {/* Main Method Toggle (Email vs Phone) */}
                    <div className="bg-gray-100 p-1 rounded-xl mb-8 flex relative">
                        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out ${loginMethod === 'PHONE' ? 'left-[calc(50%+2px)]' : 'left-1'}`}></div>
                        <button
                            type="button"
                            onClick={() => setLoginMethod('EMAIL')}
                            className={`flex-1 relative z-10 py-2.5 text-sm font-semibold transition-colors ${loginMethod === 'EMAIL' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setLoginMethod('PHONE')}
                            className={`flex-1 relative z-10 py-2.5 text-sm font-semibold transition-colors ${loginMethod === 'PHONE' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Mobile & OTP
                        </button>
                    </div>

                    {loginMethod === 'PHONE' ? (
                        <PhoneLogin />
                    ) : (
                        <>
                            {/* Email Sub-Toggle (Password vs Magic Link) */}
                            <div className="flex items-center gap-4 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setIsMagicLink(false)}
                                    className={`text-sm font-medium transition-colors ${!isMagicLink ? 'text-emerald-600 font-bold border-b-2 border-emerald-600' : 'text-gray-500'}`}
                                >
                                    Password
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsMagicLink(true)}
                                    className={`text-sm font-medium transition-colors flex items-center gap-1 ${isMagicLink ? 'text-emerald-600 font-bold border-b-2 border-emerald-600' : 'text-gray-500'}`}
                                >
                                    <Sparkles className="w-3 h-3" />
                                    Magic Link
                                </button>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-900">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                            placeholder="name@company.com"
                                            required
                                        />
                                    </div>
                                </div>

                                {!isMagicLink && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-semibold text-gray-900">Password</label>
                                            <button type="button" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">Forgot Password?</button>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                                placeholder="Enter your password"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            {isMagicLink ? 'Send Login Link' : 'Sign In to Account'}
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    <div className="mt-10 text-center">
                        <p className="text-gray-500 text-sm">
                            Don't have an account?{' '}
                            <Link href="/register" className="text-emerald-600 font-bold hover:underline">
                                Create an account
                            </Link>
                        </p>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-100">
                        <p className="text-xs text-center text-gray-400">
                            By signing in, you agree to our{' '}
                            <Link href="/terms" className="underline hover:text-gray-500">Terms of Service</Link>
                            {' '}and{' '}
                            <Link href="/privacy" className="underline hover:text-gray-500">Privacy Policy</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div >
    )
}
