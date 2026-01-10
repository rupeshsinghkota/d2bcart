'use client'

import { useState, useEffect } from 'react'
import { Truck, Check, MapPin, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DeliveryCheckerProps {
    manufacturerId?: string
    weight?: number
    dimensions?: { length: number; breadth: number; height: number }
}

export default function DeliveryChecker({ manufacturerId, weight = 0.5, dimensions }: DeliveryCheckerProps) {
    const [pincode, setPincode] = useState('')
    const [checking, setChecking] = useState(false)
    const [result, setResult] = useState<{ date?: string; error?: string } | null>(null)
    const [userPincode, setUserPincode] = useState<string | null>(null)

    // Load persisted pincode or User pincode on mount
    useEffect(() => {
        const loadPincode = async () => {
            // 1. Check logged in user
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('pincode')
                    .eq('id', user.id)
                    .single()

                if (profile && (profile as any).pincode) {
                    const pin = (profile as any).pincode
                    setUserPincode(pin)
                    setPincode(pin)
                    checkDelivery(pin)
                    return
                }
            }

            // 2. Check LocalStorage
            const stored = localStorage.getItem('d2b_pincode')
            if (stored) {
                setPincode(stored)
                checkDelivery(stored) // Optional: Auto-check if stored? Yes for better UX.
            }
        }
        loadPincode()
    }, [])

    const checkDelivery = async (pin: string) => {
        if (!pin || pin.length !== 6) return

        setChecking(true)
        setResult(null)

        try {
            const res = await fetch('/api/shiprocket/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manufacturer_id: manufacturerId,
                    delivery_pincode: pin,
                    weight: weight,
                    length: dimensions?.length || 10,
                    breadth: dimensions?.breadth || 10,
                    height: dimensions?.height || 10,
                    cod: 0 // Default to prepaid for estimation
                })
            })
            const data = await res.json()

            if (data.success) {
                setResult({ date: data.fastest?.etd || '5-7 Days' })
                localStorage.setItem('d2b_pincode', pin) // Persist
            } else {
                setResult({ error: 'Not Serviceable' }) // Should handle fallback, but let's show status
            }

        } catch (e) {
            setResult({ error: 'Check failed' })
        } finally {
            setChecking(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        checkDelivery(pincode)
    }

    return (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 my-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
                <Truck className="w-4 h-4 text-emerald-600" />
                Check Delivery Date
            </h4>

            {userPincode && result?.date ? (
                // Logged in View (Simplified)
                <div className="flex items-center gap-3 text-sm">
                    <div className="bg-emerald-100 p-2 rounded-full">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-gray-900 font-medium">Delivering to <span className="font-bold">{userPincode}</span></p>
                        <p className="text-emerald-700 text-xs mt-0.5">
                            Arrives by <span className="font-bold">{result.date}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => { setUserPincode(null); setPincode(''); setResult(null); }}
                        className="ml-auto text-xs text-emerald-600 font-bold hover:underline"
                    >
                        Change
                    </button>
                </div>
            ) : (
                // Input View
                <form onSubmit={handleSubmit} className="relative">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={pincode}
                                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Enter Pincode"
                                maxLength={6}
                                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={checking || pincode.length !== 6}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                        </button>
                    </div>

                    {/* Result Display */}
                    {result && !checking && (
                        <div className={`mt-3 text-sm flex items-center gap-2 ${result.error ? 'text-red-600' : 'text-emerald-700'}`}>
                            {result.error ? (
                                <span>{result.error}</span>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>
                                        Arrives by <span className="font-bold">{result.date}</span>
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </form>
            )}
        </div>
    )
}
