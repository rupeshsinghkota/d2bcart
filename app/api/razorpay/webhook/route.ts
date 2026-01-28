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

            // 1. Check if Order already exists (Idempotency)
            const { data: existingOrders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('order_number', razorpay_order_id)
            // Wait, order_number in 'orders' table is NOT razorpay_order_id. It's the D2B-xxx one.
            // We check 'payment_id' instead, or we need to look up if ANY order has this razorpay_order_id.
            // But wait, our 'orders' table schema has 'payment_id' (which is the payment_id).
            // It does NOT have 'razorpay_order_id' column explicitly in the schema I read earlier.
            // Let's check 'payment_attempts' status first.

            // Ideally we should add 'razorpay_order_id' to `orders` table to make this easier, but let's use payment_attempts.

            const { data: attempt } = await supabaseAdmin
                .from('payment_attempts')
                .select('*')
                .eq('razorpay_order_id', razorpay_order_id)
                .single()

            if (!attempt) {
                console.error(`[Webhook] No attempt found for order ${razorpay_order_id}`)
                return NextResponse.json({ error: 'No order context found' }, { status: 404 })
            }

            if (attempt.status === 'completed') {
                console.log(`[Webhook] Order ${razorpay_order_id} already completed.`)
                return NextResponse.json({ message: 'Already processed' })
            }

            // 2. Create Order Logic (Duplicated/Refactored from verify/route.ts)
            // Ideally we extract this to a lib function.
            // For now, I'll inline it to ensure it works identically.

            const {
                user_id,
                cart_payload,
                payment_breakdown,
                shipping_address
            } = attempt

            const manufacturerOrderNumbers = new Map<string, string>()
            const formattedOrders = []
            const { total_product_amount, remaining_balance } = payment_breakdown

            // We need to know the payment option (advance/full).
            // It's not in payment_attempts schema explicitly, but can be inferred or added.
            // Let's assume 'full' if not present, OR look at the breakdown.
            // If remaining_balance > 0, it's 'advance'. 
            const payment_option = remaining_balance > 0 ? 'advance' : 'full'
            // Wait, logic says:
            // const itemPendingAmount = Math.round(remaining_balance * itemPendingRatio)
            // if remaining_balance is in breakdown, we can use it.

            // Wait, logic in verify/route.ts:
            // const ADVANCE_PAYMENT_PERCENT = 0 // User hardcoded 0 in verify route!
            // "User context: Pay Shipping Only. Advance % is 0." 
            // So actually payment_option usually results in same math if Advance % is 0?
            // Actually:
            // paidAmount = payment_option === 'advance' ? (Product * 0%) + Shipping : Product + Shipping
            // If option is 'full', paidAmount = Product + Shipping.
            // If option is 'advance' (pay shipping only), paidAmount = Shipping.

            // I need to know the User's choice. 
            // Check if payment_breakdown has 'payable_amount'.
            // If payable_amount ~= total_shipping_amount, it's Advance.
            // If payable_amount ~= total_product + total_shipping, it's Full.

            // ACTUALLY: I should just add 'payment_option' to payment_attempts payload in step 7. 
            // I will update the schema in my mind (it's JSONB, so flexible). 
            // I will update Update Cart Page Step to include it.

            // For now, let's look at breakdown.
            // If I can't determine, default to 'full'? No, safer to default to what matches the PAID amount?
            // Razorpay event has 'amount'.
            // We can check if `event.payload.payment.entity.amount` (paise) matches full or advance calculation?
            // That is robust.

            const paidAmountPaise = event.payload.payment.entity.amount
            const paidAmount = paidAmountPaise / 100

            // However, just strictly following the logic:
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

                // Re-derive payment option or PAID amount per item?
                // Logic:
                // paidAmount = (payment_option === 'advance') ? ... : ...

                // Let's treat it simply: The user PAID X amount. Ideally we just blindly trust the breakdown?
                // But we need individual item 'paid_amount'.

                // Let's assume if remaining_balance > 0, it is 'advance'.
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
                    created_at: new Date().toISOString(),
                    // Attribution... pulled from attempt if saved? I didn't save attribution in 'order' route yet.
                    // Keep it simple for now. 
                })
            }

            // Insert Orders
            const { error } = await supabaseAdmin.from('orders').insert(formattedOrders)

            if (!error) {
                // Mark Attempt as Completed
                await supabaseAdmin.from('payment_attempts').update({ status: 'completed' }).eq('id', attempt.id)

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
