'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isMagicLink, setIsMagicLink] = useState(false)
    const router = useRouter()
    // No need to initialize store here, we use getState() below.

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
                }

                toast.success('Login successful!')

                // Redirect based on user type
                if (profile?.user_type === 'manufacturer') {
                    router.push('/manufacturer')
                } else if (profile?.user_type === 'admin') {
                    router.push('/admin')
                } else {
                    router.push('/products')
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-white py-12 px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-xl">D2B</span>
                        </div>
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
                    <p className="text-gray-600 mt-2">Sign in to your D2BCart account</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-lg">
                    {/* Toggle Switch */}
                    <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
                        <button
                            type="button"
                            onClick={() => setIsMagicLink(false)}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isMagicLink ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Password
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsMagicLink(true)}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${isMagicLink ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Magic Link
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input pl-10"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>

                        {!isMagicLink && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input pl-10"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isMagicLink ? 'Send Magic Link' : 'Sign In'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-600">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-emerald-600 font-semibold hover:underline">
                            Register Now
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
