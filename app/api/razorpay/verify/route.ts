import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/msg91'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            order_ids,
            cart_payload,
            user_id,
            user_address,
            payment_option,
            payment_breakdown,
            attribution // Extract attribution data
        } = body

        const secret = process.env.RAZORPAY_KEY_SECRET!

        // Verify Signature
        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex')

        if (generated_signature !== razorpay_signature) {
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 })
        }

        if (!cart_payload || !user_id) {
            // Fallback for old way if needed, but we are enforcing new way
            return NextResponse.json({ error: 'Missing cart payload' }, { status: 400 })
        }

        // Payment Verified - Create Orders in Database
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Idempotency Check: Check if orders already exist for this payment_id
        // This handles cases where verify is called multiple times or webhook already processed it.
        const { data: existingOrders } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('payment_id', razorpay_payment_id)
            .limit(1)

        if (existingOrders && existingOrders.length > 0) {
            console.log(`[Verify] Orders for payment ${razorpay_payment_id} already exist. Skipping creation.`)
            return NextResponse.json({ success: true, message: 'Already processed' })
        }

        // 2. Lock / Fetch Context from Payment Attempt
        // We try to lock the attempt.
        let processingAttempt: any = null

        const { data: lockResult, error: lockError } = await supabaseAdmin
            .from('payment_attempts')
            .update({ status: 'processing' })
            .eq('razorpay_order_id', razorpay_order_id)
            .eq('status', 'pending')
            .select()

        if (lockResult && lockResult.length > 0) {
            processingAttempt = lockResult[0]
        } else {
            // Lock failed. 
            // Scenario A: It's already 'completed' or 'processing' -> Idempotency check above should have caught 'completed' via orders check, but maybe it's stuck in processing?
            // Scenario B: The record DOES NOT EXIST (The issue we are fixing).

            // Let's check if the record exists at all
            const { data: attemptCheck } = await supabaseAdmin
                .from('payment_attempts')
                .select('status')
                .eq('razorpay_order_id', razorpay_order_id)
                .single()

            if (attemptCheck) {
                // Record exists but status is not pending.
                console.log(`[Verify] Payment attempt exists but status is ${attemptCheck.status}. Assuming processed.`)
                return NextResponse.json({ success: true, message: 'Already processed' })
            } else {
                // Scenario B confirmed: Record missing.
                console.warn(`[Verify] CRITICAL: Payment attempt record MISSING for order ${razorpay_order_id}. Attempting recovery from payload.`)

                // If we have the payload from the frontend, we can proceed!
                if (cart_payload && user_id && payment_breakdown && user_address) {
                    // RECOVERY MODE
                    processingAttempt = {
                        user_id,
                        cart_payload,
                        payment_breakdown,
                        shipping_address: user_address
                    }
                } else {
                    console.error('[Verify] Recovery failed. Payload missing.')
                    return NextResponse.json({ error: 'Order context missing and recovery failed' }, { status: 400 })
                }
            }
        }

        // 3. Create Orders (Logic extracted mostly from previous code, but mapped to processingAttempt)
        const current_user_id = processingAttempt.user_id
        const current_cart_payload = processingAttempt.cart_payload
        const current_payment_breakdown = processingAttempt.payment_breakdown
        const current_shipping_address = processingAttempt.shipping_address

        // Validate payload again just in case
        if (!current_cart_payload || !current_user_id) {
            return NextResponse.json({ error: 'Invalid order data' }, { status: 400 })
        }


        console.log(`[Verify] Processing payload for User: ${current_user_id}, CartItems: ${current_cart_payload?.length}`)

        const manufacturerOrderNumbers = new Map<string, string>()
        const formattedOrders = []

        const { total_product_amount, remaining_balance } = current_payment_breakdown

        for (const item of current_cart_payload) {
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

            // Determine payment option from breakdown (if balance > 0, it's advance)
            // We can utilize the 'payment_option' passed from frontend if available, or infer it.
            // Using inferred for safety.
            const isAdvance = remaining_balance > 0
            const computedPaymentOption = isAdvance ? 'advance' : 'full'

            const paidAmount = computedPaymentOption === 'advance'
                ? Math.ceil((itemTotal * ADVANCE_PAYMENT_PERCENT / 100)) + shipCost
                : itemTotal + shipCost

            formattedOrders.push({
                order_number: orderNumber,
                retailer_id: current_user_id,
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
                shipping_address: `${current_shipping_address.address}, ${current_shipping_address.city}, ${current_shipping_address.state} - ${current_shipping_address.pincode}`,
                shipping_cost: shipCost,
                courier_name: item.courier_name,
                courier_company_id: item.courier_company_id,
                payment_type: computedPaymentOption,
                paid_amount: paidAmount,
                pending_amount: itemPendingAmount,
                payment_id: razorpay_payment_id,
                created_at: new Date().toISOString(),
                // Ad Attribution
                utm_source: attribution?.utm_source,
                utm_medium: attribution?.utm_medium,
                utm_campaign: attribution?.utm_campaign,
                gclid: attribution?.gclid,
                fbclid: attribution?.fbclid,
                attribution_data: attribution
            })
        }

        if (formattedOrders.length === 0) {
            console.error('[Verify] No orders formatted. Payload empty?')
            return NextResponse.json({ error: 'No orders created from payload' }, { status: 400 })
        }

        // However, if lockResult was valid, we might want to use ITs data? 
        // Actually, the payload from frontend (cart_payload) is the source of truth for the verify call too.
        // The attempt table was just for webhook recovery. 
        // So we can safely rely on the BODY params `cart_payload`, `user_id` etc.

        const { error } = await supabaseAdmin.from('orders').insert(formattedOrders)
        if (error) {
            console.error('[Verify] DB Insert Error:', error)
            // Rollback lock if insert fails so webhook or retry can pick it up (ONLY if we managed to lock it)
            if (lockResult && lockResult.length > 0) {
                await supabaseAdmin.from('payment_attempts').update({ status: 'pending' }).eq('razorpay_order_id', razorpay_order_id)
            }
            throw error
        }

        // ... tracking and notifications ...

        // Mark Attempt as Completed (only if we had a valid lock)
        if (lockResult && lockResult.length > 0) {
            try {
                await supabaseAdmin
                    .from('payment_attempts')
                    .update({ status: 'completed', payment_id: razorpay_payment_id })
                    .eq('razorpay_order_id', razorpay_order_id)
            } catch (updateError) {
                console.error('[Verify] Failed to update payment_attempt status:', updateError)
            }
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Payment Verification Failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
