'use client'

import { useState } from 'react'
import { X, Truck, ShieldCheck } from 'lucide-react'

export default function AnnouncementBar() {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    return (
        <div className="bg-emerald-900 text-white px-4 py-2 relative z-[60]">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex-1 flex items-center justify-center gap-2 text-center text-xs sm:text-sm font-medium">
                    <span className="inline-flex items-center gap-1.5 animate-pulse text-emerald-300">
                        <ShieldCheck className="w-4 h-4" />
                        New Update:
                    </span>
                    <span className="hidden sm:inline">Pay ONLY Shipping Charges Upfront (COD) & Minimum Order Reduced to ₹3999!</span>
                    <span className="sm:hidden">Pay Shipping Only (COD) | MOQ ₹3999</span>
                </div>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-emerald-300 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
