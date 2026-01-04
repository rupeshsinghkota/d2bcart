import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple in-memory cache for the server instance
let tokenCache: { token: string | null, expiry: number | null } = {
    token: null,
    expiry: null
}

export async function POST(req: Request) {
    try {
        const { manufacturer_id, delivery_pincode, weight = 0.5, length = 10, breadth = 10, height = 10, cod = 0 } = await req.json()

        if (!delivery_pincode) {
            return NextResponse.json({ error: 'Delivery pincode required' }, { status: 400 })
        }

        let pickup_pincode = ''

        // Initialize Supabase to fetch manufacturer pincode
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        if (manufacturer_id) {
            const { data: manufacturer } = await supabaseAdmin
                .from('users')
                .select('pincode')
                .eq('id', manufacturer_id)
                .single()

            if (manufacturer?.pincode) {
                pickup_pincode = manufacturer.pincode
            }
        }

        if (!pickup_pincode) {
            // Fallback or error?
            // For estimation purposes, maybe default to Delhi/Metro?
            // Or return error
            return NextResponse.json({ error: 'Manufacturer pincode not found' }, { status: 400 })
        }

        const email = process.env.SHIPROCKET_EMAIL
        const password = process.env.SHIPROCKET_PASSWORD

        // 1. Auth (Cached)
        const now = Date.now()
        let token = tokenCache.token

        if (!token || !tokenCache.expiry || now > tokenCache.expiry) {
            console.log('Shiprocket Token Expired or Missing. Logging in...')
            const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })

            if (!authRes.ok) {
                throw new Error('Shiprocket Authentication Failed')
            }

            const authData = await authRes.json()
            token = authData.token

            // Cache for 24 hours (or slightly less to be safe)
            tokenCache = {
                token,
                expiry: now + (24 * 60 * 60 * 1000) - 60000
            }
        } else {
            // console.log('Using Cached Shiprocket Token')
        }

        // 2. Check Serviceability
        const params = new URLSearchParams({
            pickup_postcode: pickup_pincode,
            delivery_postcode: delivery_pincode,
            weight: weight.toString(),
            cod: cod.toString()
        })

        const serviceRes = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const serviceData = await serviceRes.json()

        if (serviceData.status === 200) {
            // Logic to pick a rate: Cheapest? Average?
            // User said "Customer pays". Let's charge the CHEAPEST available rate + a small buffer? 
            // Or just the cheapest.
            // shiprocket returns recommended_courier_company_id (which is usually optimal)
            // But let's look at available_courier_companies and min rate.

            const couriers = serviceData.data.available_courier_companies
            if (!couriers || couriers.length === 0) {
                return NextResponse.json({ error: 'No shipping available', rate: 0 })
            }

            // FILTER: Prioritize Premium/Trusted Couriers
            // User requested: Delhivery, BlueDart, DTDC. Adding Xpressbees/Ecom/Shadowfax as reliable backups.
            const preferredNames = ['Delhivery', 'Blue Dart', 'DTDC', 'Xpressbees', 'Ecom Express', 'Shadowfax']

            const premiumCouriers = couriers.filter((c: any) =>
                preferredNames.some(name => c.courier_name.toLowerCase().includes(name.toLowerCase()))
            )

            // If we have premium options, pick from them. Otherwise, fallback to any available (don't lose the sale).
            const candidates = premiumCouriers.length > 0 ? premiumCouriers : couriers

            // Calculations
            // 1. Cheapest from the CANDIDATES list
            const cheapest = candidates.reduce((prev: any, curr: any) => prev.rate < curr.rate ? prev : curr)

            // 2. Fastest from the CANDIDATES list
            const fastest = candidates.reduce((prev: any, curr: any) => {
                if (!prev.etd) return curr
                if (!curr.etd) return prev
                return new Date(prev.etd) < new Date(curr.etd) ? prev : curr
            })

            return NextResponse.json({
                success: true,
                couriers: candidates.sort((a: any, b: any) => a.rate - b.rate), // Return filtered sorted
                cheapest: {
                    rate: cheapest.rate,
                    etd: cheapest.etd,
                    courier_name: cheapest.courier_name,
                    id: cheapest.courier_company_id
                },
                fastest: {
                    rate: fastest.rate,
                    etd: fastest.etd,
                    courier_name: fastest.courier_name,
                    id: fastest.courier_company_id
                }
            })
        } else {
            return NextResponse.json({ error: serviceData.message, rate: 0 })
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
