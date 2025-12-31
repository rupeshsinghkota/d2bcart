import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json()

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
        }

        // Initialize Admin Supabase Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Fetch Order Details
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                retailer:users!orders_retailer_id_fkey(pincode),
                manufacturer:users!orders_manufacturer_id_fkey(pincode)
            `)
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // 2. Authenticate with Shiprocket
        const email = process.env.SHIPROCKET_EMAIL
        const password = process.env.SHIPROCKET_PASSWORD

        const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        const authData = await authResponse.json()
        if (!authData.token) {
            return NextResponse.json({ error: 'Shiprocket Auth Failed' }, { status: 500 })
        }
        const token = authData.token

        // 3. Check Serviceability
        // Assume 0.5kg if not specified
        const weight = 0.5
        const cod = order.status === 'paid' ? 0 : 1 // 0 for prepaid, 1 for cod

        // Construct Query Params
        const params = new URLSearchParams({
            pickup_postcode: order.manufacturer.pincode,
            delivery_postcode: order.retailer.pincode,
            weight: weight.toString(),
            cod: cod.toString()
        })

        const serviceUrl = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params.toString()}`

        const serviceResponse = await fetch(serviceUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })

        const serviceData = await serviceResponse.json()

        if (serviceData.status === 200) {
            // Return recommended couriers
            // shiprocket returns data.available_courier_companies
            return NextResponse.json({
                success: true,
                couriers: serviceData.data.available_courier_companies
            })
        } else {
            return NextResponse.json({
                success: false,
                message: serviceData.message || 'Serviceability check failed'
            })
        }

    } catch (error: any) {
        console.error('Serviceability API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
