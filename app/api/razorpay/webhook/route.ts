import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/msg91'

export async function POST(req: Request) {
    try {
        const body = await req.text() // Webhook body is raw text for signature verification
        const razorpay_signature = req.headers.get('x-razorpay-signature')

        if (!razorpay_signature) {
            return NextResponse.json({ error: 'Missing Signature' }, { status: 400 })
        }

        const secret = process.env.RAZORPAY_WEBHOOK_SECRET
        if (!secret) {
            console.error('RAZORPAY_WEBHOOK_SECRET is not set')
            return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 })
        }

        // Verify Signature
        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex')

        if (generated_signature !== razorpay_signature) {
            console.error('Invalid Webhook Signature')
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 })
        }

        const event = JSON.parse(body)

        // We only care about order.paid (or payment.captured, but order.paid is cleaner for order creation)
        if (event.event === 'order.paid') {
            const razorpay_order_id = event.payload.order.entity.id
            const razorpay_payment_id = event.payload.payment?.entity?.id // Might be in payment.entity or payload.payment.entity

            // Note: In typical order.paid event, payload has: { order: { entity: {...} }, payment: { entity: {...} } }

            console.log(`[Webhook] Order Paid: ${razorpay_order_id}`)

            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            // 1. Idempotency Check: Check if orders already exist (Verify/Frontend might have won the race)
            const { data: existingOrders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('payment_id', razorpay_payment_id) // Or use razorpay_order_id if payment_id structure varies
                .limit(1)

            if (existingOrders && existingOrders.length > 0) {
                console.log(`[Webhook] Orders for payment ${razorpay_payment_id} already exist. Skipping.`)
                return NextResponse.json({ message: 'Already processed' })
            }

            // 2. Check & Lock Attempt (Atomic)
            const { data: lockResult, error: lockError } = await supabaseAdmin
                .from('payment_attempts')
                .update({ status: 'processing' })
                .eq('razorpay_order_id', razorpay_order_id)
                .eq('status', 'pending')
                .select()

            if (lockError || !lockResult || lockResult.length === 0) {
                // If lock failed, it COULD mean it's processing, completed, OR MISSING.
                // Since Webhook cannot "Recover" payload (it doesn't have it), we effectively have to stop.
                // We assume Verify handled it or it's genuinely missing (which is bad, but nothing webhook can do).
                console.log(`[Webhook] Order ${razorpay_order_id} already being processed, completed, or missing attempt. Skipping.`)
                return NextResponse.json({ message: 'Already processed or missing context' })
            }

            const attempt = lockResult[0]

            // 2. Create Order Logic 
            const {
                user_id,
                cart_payload,
                payment_breakdown,
                shipping_address
            } = attempt

            const manufacturerOrderNumbers = new Map<string, string>()
            const formattedOrders = []
            const { total_product_amount, remaining_balance } = payment_breakdown

            const payment_option = remaining_balance > 0 ? 'advance' : 'full'
            const ADVANCE_PAYMENT_PERCENT = 0

            for (const item of cart_payload) {
                const mfId = item.manufacturer_id

                if (!manufacturerOrderNumbers.has(mfId)) {
                    manufacturerOrderNumbers.set(mfId, `D2B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`)
                }
                const orderNumber = manufacturerOrderNumbers.get(mfId)

                const manufacturerPayout = item.base_price * item.quantity
                const platformProfit = item.your_margin * item.quantity

                const itemTotal = item.unit_price * item.quantity
                const shipCost = item.ship_cost

                const itemPendingRatio = itemTotal / total_product_amount
                const itemPendingAmount = Math.round(remaining_balance * itemPendingRatio)

                const isAdvance = remaining_balance > 0
                const computedPaymentOption = isAdvance ? 'advance' : 'full'

                const itemPaidAmount = isAdvance
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
                    status: 'paid',
                    shipping_address: `${shipping_address.address}, ${shipping_address.city}, ${shipping_address.state} - ${shipping_address.pincode}`,
                    shipping_cost: shipCost,
                    courier_name: item.courier_name,
                    courier_company_id: item.courier_company_id,
                    payment_type: computedPaymentOption,
                    paid_amount: itemPaidAmount,
                    pending_amount: itemPendingAmount,
                    payment_id: razorpay_payment_id || 'webhook_recovered',
                    created_at: new Date().toISOString()
                })
            }

            // Insert Orders
            const { error } = await supabaseAdmin.from('orders').insert(formattedOrders)

            if (!error) {
                // Mark Attempt as Completed
                await supabaseAdmin.from('payment_attempts').update({
                    status: 'completed',
                    payment_id: razorpay_payment_id
                }).eq('id', attempt.id)

                // Send WhatsApp (Copy-paste logic)
                try {
                    const adminPhone = process.env.NEXT_PUBLIC_ADMIN_PHONE || "917557777987"
                    const templateName = process.env.MSG91_TEMPLATE_NEW_ORDER || "d2b_new_order_admin"
                    await sendWhatsAppMessage({
                        mobile: adminPhone,
                        templateName: templateName,
                        components: [
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', text: formattedOrders[0].order_number }
                                ]
                            }
                        ]
                    })
                } catch (waError) {
                    console.error('WhatsApp Notification Failed:', waError)
                }
            } else {
                console.error('[Webhook] Failed to insert orders:', error)
                return NextResponse.json({ error: 'DB Insert Failed' }, { status: 500 })
            }

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ status: 'ignored' })
    } catch (error: any) {
        console.error('Webhook processing failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
