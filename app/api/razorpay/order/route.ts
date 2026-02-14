import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

// Initialize Razorpay
// Note: We expect RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in env variables
// Initialize lazily or check for keys
let razorpay: Razorpay | null = null

export async function POST(req: Request) {
    try {
        const key_id = process.env.RAZORPAY_KEY_ID
        const key_secret = process.env.RAZORPAY_KEY_SECRET

        if (!key_id || !key_secret) {
            console.error('Razorpay keys missing in environment variables')
            return NextResponse.json({ error: 'Payment gateway configuration missing' }, { status: 500 })
        }

        if (!razorpay) {
            razorpay = new Razorpay({ key_id, key_secret })
        }

        const body = await req.json()
        const {
            amount,
            currency = 'INR',
            receipt,
            // Context data for webhook recovery
            user_id,
            cart_payload,
            payment_breakdown,
            shipping_address
        } = body

        if (!amount) {
            return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
        }

        const options = {
            amount: Math.round(amount * 100), // Razorpay accepts amount in paise
            currency,
            receipt: receipt || `receipt_${Date.now()}`
        }

        const order = await razorpay.orders.create(options)

        // Save Attempt for Webhook Recovery
        if (user_id && cart_payload) {
            const { createClient } = await import('@supabase/supabase-js')
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            const { error: attemptError } = await supabaseAdmin
                .from('payment_attempts')
                .insert({
                    razorpay_order_id: order.id,
                    user_id,
                    cart_payload,
                    payment_breakdown,
                    shipping_address,
                    status: 'pending'
                })

            if (attemptError) {
                console.error('Failed to save payment attempt:', attemptError)
                // CRITICAL: If we can't save the tracking attempt, we MUST NOT allow the payment to proceed.
                // Otherwise, we risk a "Ghost Order" where money is deducted but we have no record to verify against.
                return NextResponse.json({ error: 'Order initialization failed. Please try again.' }, { status: 500 })
            }
        }

        return NextResponse.json(order)
    } catch (error: any) {
        console.error('Razorpay Order Creation Failed:', error)
        return NextResponse.json({ error: error.message || 'Payment processing failed' }, { status: 500 })
    }
}
