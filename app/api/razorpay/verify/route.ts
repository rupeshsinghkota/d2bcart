import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            order_ids // Accept array of internal order IDs
        } = await req.json()

        const secret = process.env.RAZORPAY_KEY_SECRET!

        // Verify Signature
        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex')

        if (generated_signature !== razorpay_signature) {
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 })
        }

        // Payment Verified - Update Database
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Update Orders to PAID
        const { error } = await supabaseAdmin
            .from('orders')
            .update({
                status: 'paid',
                payment_id: razorpay_payment_id
            })
            .in('id', order_ids)

        if (error) throw error

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Payment Verification Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
