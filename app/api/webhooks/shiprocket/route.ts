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

        if (cs === 'DELIVERED' || current_status_id === 7) {
            newStatus = 'delivered'
        } else if (cs === 'SHIPPED' || current_status_id === 6) {
            newStatus = 'shipped'
        } else if (cs.includes('CANCEL') || current_status_id === 8) {
            newStatus = 'cancelled'
        }

        if (newStatus) {
            const { error } = await supabaseAdmin
                .from('orders')
                .update({ status: newStatus })
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
