import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        console.log('Shiprocket Webhook received:', body)

        const { awb, current_status, current_status_id } = body

        if (!awb) {
            return NextResponse.json({ error: 'No AWB found' }, { status: 400 })
        }

        // Initialize Supabase with Service Role Key for Admin privileges (Bypass RLS)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        let newStatus = ''
        const cs = current_status?.toUpperCase() || ''
        const sid = Number(current_status_id)

        // Comprehensive Mapping Based on Shiprocket Documentation
        // 6: Shipped, 11: Dispatched, 17: In Transit, 18: Out for Delivery, 7: Delivered
        // 8: Cancelled, 19: RTO Initiated, 20: RTO Delivered

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

        if (newStatus) {
            const updateData: any = { status: newStatus }

            // Auto-update timestamps for key events
            if (newStatus === 'shipped') updateData.shipped_at = new Date().toISOString()
            if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString()

            const { error } = await supabaseAdmin
                .from('orders')
                .update(updateData)
                .eq('awb_code', awb)

            if (error) {
                console.error('Webhook update failed:', error)
                return NextResponse.json({ error: error.message }, { status: 200 })
            }

            console.log(`Order with AWB ${awb} updated to ${newStatus}`)
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
