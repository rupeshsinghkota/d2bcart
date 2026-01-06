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

        // 4. Handle Pickup Location (Use primary order's manufacturer)
        let pickupLocationCode = primaryOrder.manufacturer.shiprocket_pickup_code

        if (!pickupLocationCode) {
            const pickupNickname = `MANUF_${primaryOrder.manufacturer.id.substring(0, 8)}`
            // ... (Existing Pickup Creation Logic could be here, simplified for brevity as it was working)
            // Re-using existing pickup logic block if possible or assuming established. 
            // Ideally we copy the logic block. I will inject the registration logic briefly.
            const pickupPayload = {
                pickup_location: pickupNickname,
                name: primaryOrder.manufacturer.business_name || 'Wholesaler',
                email: primaryOrder.manufacturer.email,
                phone: primaryOrder.manufacturer.phone,
                address: (primaryOrder.manufacturer.address?.length > 10) ? primaryOrder.manufacturer.address : `Shop No 1, ${primaryOrder.manufacturer.address || "Main Market"}`,
                city: primaryOrder.manufacturer.city,
                state: primaryOrder.manufacturer.state || "Delhi",
                country: "India",
                pin_code: primaryOrder.manufacturer.pincode || "110001"
            }

            const addPickupResponse = await fetch('https://apiv2.shiprocket.in/v1/external/settings/company/addpickup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(pickupPayload)
            })
            const pickupData = await addPickupResponse.json()
            if (pickupData.success || (pickupData.message && pickupData.message.includes('already exists'))) {
                pickupLocationCode = pickupNickname
                await supabaseAdmin.from('users').update({ shiprocket_pickup_code: pickupNickname }).eq('id', primaryOrder.manufacturer.id)
            } else {
                return NextResponse.json({ error: `Failed to register pickup location: ${JSON.stringify(pickupData.errors || pickupData.message)}` }, { status: 400 })
            }
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
