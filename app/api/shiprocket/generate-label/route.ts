import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const { shipmentId, orderId } = await req.json()

        if (!shipmentId) {
            return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 })
        }

        // 1. Validate Env Vars
        const email = process.env.SHIPROCKET_EMAIL
        const password = process.env.SHIPROCKET_PASSWORD

        if (!email || !password) {
            return NextResponse.json({ error: 'Shiprocket credentials not configured' }, { status: 500 })
        }

        // 2. Authenticate
        const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        const authData = await authResponse.json()
        const token = authData.token

        if (!token) {
            return NextResponse.json({ error: 'Shiprocket authentication failed' }, { status: 401 })
        }

        // 3. Generate Label
        const labelResponse = await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/label', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ shipment_id: [shipmentId] })
        })

        const labelData = await labelResponse.json()

        if (!labelData.label_url) {
            return NextResponse.json({ error: 'Failed to generate label' }, { status: 400 })
        }

        // 4. Update Supabase with Label URL
        // Use Admin Client to bypass RLS
        if (orderId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            await supabaseAdmin
                .from('orders')
                .update({ shipping_label_url: labelData.label_url })
                .eq('id', orderId)
        }

        return NextResponse.json({
            success: true,
            label_url: labelData.label_url
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
