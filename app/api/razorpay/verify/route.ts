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

        const body = await req.json()
        const { cart_payload, user_id, user_address, payment_option, payment_breakdown } = body

        if (!cart_payload || !user_id) {
            // Fallback for old way if needed, but we are enforcing new way
            return NextResponse.json({ error: 'Missing cart payload' }, { status: 400 })
        }

        // Payment Verified - Create Orders in Database
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const manufacturerOrderNumbers = new Map<string, string>()
        const formattedOrders = []

        // Re-calculate some totals for safety or rely on breakdown?
        // Using breakdown for distribution logic
        const { total_product_amount, remaining_balance } = payment_breakdown

        for (const item of cart_payload) {
            const mfId = item.manufacturer_id

            if (!manufacturerOrderNumbers.has(mfId)) {
                manufacturerOrderNumbers.set(mfId, `D2B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`)
            }
            const orderNumber = manufacturerOrderNumbers.get(mfId)

            const manufacturerPayout = item.base_price * item.quantity
            const platformProfit = item.your_margin * item.quantity

            const itemTotal = item.unit_price * item.quantity
            const shipCost = item.ship_cost // Already distributed in frontend logic

            // Re-calculate PAID vs PENDING based on logic
            // Need ADVANCE_PAYMENT_PERCENT. Can't import client constant. Hardcode 0 or pass it?
            // User context: Pay Shipping Only. Advance % is 0.
            const ADVANCE_PAYMENT_PERCENT = 0 // Aligning with current logic

            const itemPendingRatio = itemTotal / total_product_amount
            const itemPendingAmount = Math.round(remaining_balance * itemPendingRatio)

            const paidAmount = payment_option === 'advance'
                ? Math.ceil((itemTotal * ADVANCE_PAYMENT_PERCENT / 100)) + shipCost
                : itemTotal + shipCost

            formattedOrders.push({
                order_number: orderNumber,
                retailer_id: user_id,
                manufacturer_id: mfId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_amount: itemTotal + shipCost,
                tax_amount: 0,
                tax_rate_snapshot: item.tax_rate,
                manufacturer_payout: manufacturerPayout,
                platform_profit: platformProfit + (shipCost * 0.1),
                status: 'paid', // Immediately PAID
                shipping_address: `${user_address.address}, ${user_address.city}, ${user_address.state} - ${user_address.pincode}`,
                shipping_cost: shipCost,
                courier_name: item.courier_name,
                courier_company_id: item.courier_company_id,
                payment_type: payment_option,
                paid_amount: paidAmount,
                pending_amount: itemPendingAmount,
                payment_id: razorpay_payment_id,
                created_at: new Date().toISOString()
            })
        }

        const { error } = await supabaseAdmin.from('orders').insert(formattedOrders)

        if (error) throw error

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Payment Verification Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
