import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        // Support both single 'orderId' and array 'orderIds'
        const orderIds = body.orderIds || (body.orderId ? [body.orderId] : [])

        if (orderIds.length === 0) {
            return NextResponse.json({ error: 'Order ID(s) required' }, { status: 400 })
        }

        console.log('API: Creating shipment for Order IDs:', orderIds)

        // Initialize Admin Supabase Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Get All Orders Details
        const { data: orders, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                product:products(name, images, weight, length, breadth, height),
                retailer:users!orders_retailer_id_fkey(business_name, city, address, phone, state, pincode, email),
                manufacturer:users!orders_manufacturer_id_fkey(id, business_name, city, address, phone, state, pincode, email, shiprocket_pickup_code)
            `)
            .in('id', orderIds)

        if (ordersError || !orders || orders.length === 0) {
            console.error('Orders fetch error:', ordersError)
            return NextResponse.json({ error: 'Orders not found' }, { status: 404 })
        }

        // Validate: All orders must be from same manufacturer and retailer (to group shipment)
        const manufacturerId = orders[0].manufacturer_id
        const retailerId = orders[0].retailer_id

        const isHomogeneous = orders.every(o => o.manufacturer_id === manufacturerId && o.retailer_id === retailerId)
        if (!isHomogeneous) {
            return NextResponse.json({ error: 'Cannot group orders from different manufacturers or to different retailers' }, { status: 400 })
        }

        const primaryOrder = orders[0]

        // 2. Validate Env Vars
        const email = process.env.SHIPROCKET_EMAIL
        const password = process.env.SHIPROCKET_PASSWORD

        if (!email || !password) {
            return NextResponse.json({ error: 'Shiprocket credentials not configured' }, { status: 500 })
        }

        // 3. Authenticate with Shiprocket
        const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        const authData = await authResponse.json()
        if (!authData.token) {
            return NextResponse.json({ error: 'Shiprocket authentication failed', details: authData }, { status: 401 })
        }
        const token = authData.token

        // 4. Handle Pickup Location (Auto-Sync Address)
        // We generate a unique pickup code based on the address hash. 
        // If address changes, hash changes -> new code -> new pickup location registration.

        const mfr = primaryOrder.manufacturer
        const addressAuthString = `${mfr.address}|${mfr.city}|${mfr.state}|${mfr.pincode}|${mfr.phone}`.toLowerCase().replace(/\s/g, '')

        // Simple hash function (or import crypto if environment allows, but basic DJB2 or similar is enough for this)
        // Using built-in crypto is safer if available in Edge/Node runtime
        const crypto = require('crypto')
        const addressHash = crypto.createHash('md5').update(addressAuthString).digest('hex').substring(0, 6).toUpperCase()

        const pickupLocationName = `MANUF_${mfr.id.split('-')[0].substring(0, 8)}_${addressHash}`
        let pickupLocationCode = mfr.shiprocket_pickup_code

        // If code differs (or doesn't exist), register new one
        if (pickupLocationCode !== pickupLocationName) {
            console.log(`[Shiprocket] Address changed (Hash: ${addressHash}). Registering new pickup: ${pickupLocationName}`)

            const pickupPayload = {
                pickup_location: pickupLocationName,
                name: mfr.business_name || 'Wholesaler',
                email: mfr.email,
                phone: mfr.phone,
                address: (mfr.address?.length > 10) ? mfr.address : `Shop 1, ${mfr.address || "Market"}`, // Validation
                city: mfr.city,
                state: mfr.state || "Delhi",
                country: "India",
                pin_code: mfr.pincode || "110001"
            }

            const addPickupResponse = await fetch('https://apiv2.shiprocket.in/v1/external/settings/company/addpickup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(pickupPayload)
            })

            const pickupData = await addPickupResponse.json()

            // Success OR "Already Exists" (in case we retrying same hash but DB wasn't updated)
            if (pickupData.success || (pickupData.message && pickupData.message.includes('already exists'))) {
                // Update DB with NEW code
                pickupLocationCode = pickupLocationName
                await supabaseAdmin.from('users').update({ shiprocket_pickup_code: pickupLocationName }).eq('id', mfr.id)
            } else {
                console.error('[Shiprocket] Pickup Creation Failed:', pickupData)
                // Fallback: If creation fails, try using existing code if available, else error
                if (!pickupLocationCode) {
                    return NextResponse.json({ error: `Failed to register pickup location: ${JSON.stringify(pickupData.errors || pickupData.message)}` }, { status: 400 })
                }
                // If we have an old code, we might proceed but warn? No, address mismatch is bad.
                // But preventing shipment is worse. Proceeding with old code (implicit fallback if variable assignment skipped)
                // Actually current var 'pickupLocationCode' still holds old value.
            }
        }

        // Verify final code
        if (!pickupLocationCode) {
            // Should not happen unless logic above failed for fresh user
            return NextResponse.json({ error: 'Could not resolve pickup location code' }, { status: 400 })
        }

        // 5. Build Aggregated Order Payload
        // Check if ANY item needs COD
        const totalPendingAmount = orders.reduce((sum, o) => sum + (o.pending_amount || 0), 0)
        const isShipmentCod = totalPendingAmount > 0
        const paymentMethod = isShipmentCod ? "COD" : "Prepaid"

        const orderItemsPayload = orders.map(order => {
            // If shipment is COD, we need to carefully set selling_price to collect the correct amount
            // Strategy: 
            // - If Item has pending amount => price = pending / qty
            // - If Item is fully paid => price = 0 (So we don't double collect)
            // - If shipment is Prepaid => price = unit_price (value declaration)

            let sellingPrice = order.unit_price
            if (isShipmentCod) {
                const pending = order.pending_amount || 0
                if (pending > 0) {
                    sellingPrice = pending / order.quantity
                } else {
                    sellingPrice = 0 // Fully paid item in a COD shipment gets 0 collectible value
                }
            }

            return {
                name: order.product.name,
                sku: order.product_id,
                units: order.quantity,
                selling_price: sellingPrice,
                discount: "",
                tax: "",
                hsn: ""
            }
        })

        const subTotal = isShipmentCod
            ? totalPendingAmount
            : orders.reduce((sum, o) => sum + (o.unit_price * o.quantity), 0)

        // Aggregated Weight & Dimensions Logic
        // Logic: Product Weight/Dimensions are for the "MOQ Set" (e.g. 10 units = 5kg)
        // Quantity is "Total Units".
        // Sets Count = Quantity / MOQ

        let totalWeight = 0
        let totalVolume = 0
        let maxL = 10, maxB = 10

        orders.forEach(o => {
            const moq = o.product.moq || 1
            const setsCount = o.quantity / moq // e.g. 20 units / 10 moq = 2 sets

            const w = o.product.weight || 0.5
            totalWeight += w * setsCount

            const l = o.product.length || 10
            const b = o.product.breadth || 10
            const h = o.product.height || 10
            const vol = l * b * h

            totalVolume += vol * setsCount

            maxL = Math.max(maxL, l)
            maxB = Math.max(maxB, b)
        })

        // Calculate height required to fit total volume given maxL and maxB
        // Vol = L * B * H  =>  H = Vol / (L * B)
        const calculatedHeight = Math.ceil(totalVolume / (maxL * maxB)) || 10

        const orderPayload = {
            order_id: primaryOrder.order_number, // Use the shared Order Number (they should match if grouped)
            order_date: new Date(primaryOrder.created_at).toISOString().split('T')[0],
            pickup_location: pickupLocationCode,
            billing_customer_name: primaryOrder.retailer.business_name,
            billing_last_name: "Retailer",
            billing_address: primaryOrder.retailer.address || "Not Provided",
            billing_city: primaryOrder.retailer.city,
            billing_pincode: primaryOrder.retailer.pincode || "110001",
            billing_state: primaryOrder.retailer.state || "Delhi",
            billing_country: "India",
            billing_email: primaryOrder.retailer.email || "retailer@example.com",
            billing_phone: primaryOrder.retailer.phone,
            shipping_is_billing: true,
            order_items: orderItemsPayload,
            payment_method: paymentMethod,
            sub_total: subTotal,
            length: maxL,
            breadth: maxB,
            height: calculatedHeight,
            weight: totalWeight // in KG
        }

        // Call ShipRocket
        const createOrderResponse = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(orderPayload)
        })

        const shiprocketOrder = await createOrderResponse.json()

        if (!shiprocketOrder.order_id) {
            console.error('Shiprocket Error:', shiprocketOrder)
            return NextResponse.json({ error: `Shiprocket Error: ${shiprocketOrder.message || JSON.stringify(shiprocketOrder.errors)}` }, { status: 400 })
        }

        // 6. AWB & Pickup (Simplified: Reuse same flow)
        // Note: For bulk, assigning courier might fail if we specify ONE courier ID but we have multiple items? 
        // We just don't specify courier_id for bulk to let SR choose best? 
        // Or if primaryOrder has courier preference?
        const awbPayload: any = { shipment_id: shiprocketOrder.shipment_id }
        // Only force courier if it's a single order. For bulk, the weight might exceed the specific courier's limit.
        // Letting ShipRocket auto-assign ensure we get a valid courier for the total weight.
        if (orderIds.length === 1 && primaryOrder.courier_company_id) {
            awbPayload.courier_id = primaryOrder.courier_company_id
        }

        const awbResponse = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(awbPayload)
        })
        const awbData = await awbResponse.json()

        let awbCode = awbData.response?.data?.awb_code
        let courierName = awbData.response?.data?.courier_name

        if (!awbCode) {
            console.error('AWB Assignment Failed:', awbData)
            const errorMessage = awbData.message || (awbData.response?.data?.awb_assign_error) || 'AWB assignment failed'
            return NextResponse.json({ error: errorMessage, details: awbData }, { status: 400 })
        }

        // Generate Pickup
        await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/pickup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ shipment_id: [shiprocketOrder.shipment_id] })
        })

        // Generate Manifest
        await fetch('https://apiv2.shiprocket.in/v1/external/manifests/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ shipment_id: [shiprocketOrder.shipment_id] })
        })

        // 9. Update ALL Orders in Supabase
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
                shipment_id: shiprocketOrder.shipment_id,
                status: 'confirmed',
                awb_code: awbCode,
                courier_name: courierName,
                paid_at: new Date().toISOString()
            } as any)
            .in('id', orderIds) // Update ALL

        if (updateError) console.error('Supabase update error:', updateError)

        return NextResponse.json({
            success: true,
            shipment_id: shiprocketOrder.shipment_id,
            awb: awbCode,
            courier: courierName
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
