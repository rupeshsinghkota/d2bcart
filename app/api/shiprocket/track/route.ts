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

        // 1. Get Order Details (Need AWB)
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, awb_code, status, shipment_id')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        if (!order.awb_code) {
            return NextResponse.json({ message: 'No AWB assigned yet', status: order.status })
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
            console.error('Shiprocket Auth Failed during tracking:', authData)
            return NextResponse.json({ error: 'Shiprocket Auth Failed' }, { status: 500 })
        }
        const token = authData.token

        // 3. Get Tracking Data
        const trackResponse = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${order.awb_code}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })

        const trackData = await trackResponse.json()

        // 4. Map Status and Update DB
        // Shiprocket returns various statuses. We care mainly about 'DELIVERED', 'SHIPPED', 'CANCELED'
        // tracking_data.track_status is usually 0 or 1, shipment_track[0].current_status is the string

        const shipmentUpload = trackData?.tracking_data?.shipment_track?.[0]

        if (shipmentUpload) {
            const cs = shipmentUpload.current_status?.toUpperCase() || ''
            const sid = Number(shipmentUpload.current_status_id)

            let newStatus = order.status

            if (sid === 7 || cs === 'DELIVERED') {
                newStatus = 'delivered'
            } else if (sid === 18 || cs === 'OUT FOR DELIVERY') {
                newStatus = 'out_for_delivery'
            } else if (sid === 17 || cs === 'IN TRANSIT') {
                newStatus = 'in_transit'
            } else if (sid === 6 || sid === 11 || cs === 'SHIPPED' || cs === 'DISPATCHED') {
                newStatus = 'shipped'
            } else if (sid === 8 || cs.includes('CANCEL')) {
                newStatus = 'cancelled'
            } else if (sid === 19 || cs === 'RTO INITIATED') {
                newStatus = 'rto_initiated'
            } else if (sid === 20 || cs === 'RTO DELIVERED') {
                newStatus = 'rto_delivered'
            }

            // Update if changed and not reverting a final state
            const finalStates = ['delivered', 'cancelled', 'rto_delivered']
            if (newStatus !== order.status && !finalStates.includes(order.status)) {
                const updates: any = { status: newStatus }
                if (newStatus === 'shipped') updates.shipped_at = new Date().toISOString()
                if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString()

                await supabaseAdmin
                    .from('orders')
                    .update(updates)
                    .eq('id', orderId)

                return NextResponse.json({
                    success: true,
                    updated: true,
                    oldStatus: order.status,
                    newStatus: newStatus,
                    tracking: shipmentUpload
                })
            }
        }

        return NextResponse.json({
            success: true,
            updated: false,
            status: order.status,
            tracking: shipmentUpload
        })

    } catch (error: any) {
        console.error('Tracking API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
