'use client'

import { ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function TrustPolicy() {
    return (
        <div className="mt-4 flex md:grid md:grid-cols-3 gap-3 overflow-x-auto pb-2 md:pb-0 snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 scroll-pl-4">
            {/* 7-Day Replacement Policy */}
            <div className="flex-none w-[85%] md:w-auto snap-center flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="bg-white p-2 rounded-full shadow-sm shrink-0">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">7-Day Replacement</h4>
                    <p className="text-[10px] sm:text-xs text-blue-700 mt-0.5 font-medium">For damaged or defective items</p>
                </div>
            </div>

            {/* Payment Protection */}
            <div className="flex-none w-[85%] md:w-auto snap-center flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="bg-white p-2 rounded-full shadow-sm shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">100% Payment Protection</h4>
                    <p className="text-[10px] sm:text-xs text-emerald-700 mt-0.5 font-medium">Secure Payment Gateway</p>
                </div>
            </div>

            {/* Verified Sellers */}
            <div className="flex-none w-[85%] md:w-auto snap-center flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="bg-white p-2 rounded-full shadow-sm shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">Assured Quality</h4>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 font-medium">Verified Sellers & Products</p>
                </div>
            </div>
        </div>
    )
}
