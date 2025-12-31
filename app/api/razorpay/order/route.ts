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

        const { amount, currency = 'INR', receipt } = await req.json()

        if (!amount) {
            return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
        }

        const options = {
            amount: Math.round(amount * 100), // Razorpay accepts amount in paise
            currency,
            receipt: receipt || `receipt_${Date.now()}`
        }

        const order = await razorpay.orders.create(options)

        return NextResponse.json(order)
    } catch (error: any) {
        console.error('Razorpay Order Creation Failed:', error)
        return NextResponse.json({ error: error.message || 'Payment processing failed' }, { status: 500 })
    }
}
