import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            internal_order_id
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

        // Update Order to PAID
        // Also verify that the order belongs to the user or matches amount? 
        // For now, simple update.
        const { error } = await supabaseAdmin
            .from('orders')
            .update({
                status: 'paid',
                // We could store payment_id here if we had a column
                // payment_id: razorpay_payment_id 
            })
            .eq('id', internal_order_id)

        if (error) throw error

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Payment Verification Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
