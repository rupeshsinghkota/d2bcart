import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json()

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
        }

        console.log('API: Creating shipment for Order ID:', orderId)
        console.log('API: Service Role Key Present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

        // Initialize Admin Supabase Client to bypass RLS
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Get Order Details from Supabase
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
        *,
        product:products(name, images, weight, length, breadth, height),
        retailer:users!orders_retailer_id_fkey(business_name, city, address, phone, state, pincode, email),
        manufacturer:users!orders_manufacturer_id_fkey(id, business_name, city, address, phone, state, pincode, email, shiprocket_pickup_code)
      `)
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            console.error('Order fetch error:', orderError)
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // 2. Validate Env Vars
        const email = process.env.SHIPROCKET_EMAIL
        const password = process.env.SHIPROCKET_PASSWORD

        if (!email || !password) {
            return NextResponse.json({ error: 'Shiprocket credentials not configured' }, { status: 500 })
        }

        // 3. Authenticate with Shiprocket
        console.log('API: Shiprocket Auth Attempt with:', { email, passwordLength: password?.length })

        const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        const authData = await authResponse.json()
        console.log('API: Shiprocket Auth Response:', JSON.stringify(authData))

        if (!authData.token) {
            return NextResponse.json({ error: 'Shiprocket authentication failed', details: authData }, { status: 401 })
        }
        const token = authData.token

        // 4. Handle Pickup Location
        let pickupLocationCode = order.manufacturer.shiprocket_pickup_code

        if (!pickupLocationCode) {
            // Create new pickup location for manufacturer
            // Use potentially updated manufacturer details from the 'users' table (via the order join)
            const pickupNickname = `MANUF_${order.manufacturer.id.substring(0, 8)}`
            const pickupPayload = {
                pickup_location: pickupNickname,
                name: order.manufacturer.business_name || 'Manufacturer',
                email: order.manufacturer.email,
                phone: order.manufacturer.phone,
                address: (order.manufacturer.address?.length > 10) ? order.manufacturer.address : `Shop No 1, ${order.manufacturer.address || "Main Market"}`,
                address_2: "",
                city: order.manufacturer.city,
                state: order.manufacturer.state || "Delhi",
                country: "India",
                pin_code: order.manufacturer.pincode || "110001"
            }

            console.log('API: Registering Pickup Location:', pickupNickname)
            console.log('API: Pickup Payload:', JSON.stringify(pickupPayload, null, 2))

            const addPickupResponse = await fetch('https://apiv2.shiprocket.in/v1/external/settings/company/addpickup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(pickupPayload)
            })

            const pickupData = await addPickupResponse.json()

            if (pickupData.success || (pickupData.message && pickupData.message.includes('already exists'))) {
                pickupLocationCode = pickupNickname

                // Save to Supabase using Admin client
                await supabaseAdmin
                    .from('users')
                    .update({ shiprocket_pickup_code: pickupNickname })
                    .eq('id', order.manufacturer.id)
            } else {
                console.error("Failed to create pickup location:", pickupData)
                return NextResponse.json({ error: `Failed to register pickup location: ${JSON.stringify(pickupData.errors || pickupData.message)}` }, { status: 400 })
            }
        }

        // 5. Create Order in Shiprocket
        const orderPayload = {
            order_id: order.order_number,
            order_date: new Date(order.created_at).toISOString().split('T')[0],
            pickup_location: pickupLocationCode,
            billing_customer_name: order.retailer.business_name,
            billing_last_name: "Retailer",
            billing_address: order.retailer.address || "Not Provided",
            billing_city: order.retailer.city,
            billing_pincode: order.retailer.pincode || "110001",
            billing_state: order.retailer.state || "Delhi",
            billing_country: "India",
            billing_email: order.retailer.email || "retailer@example.com",
            billing_phone: order.retailer.phone,
            shipping_is_billing: true,
            order_items: [
                {
                    name: order.product.name,
                    sku: order.product_id,
                    units: order.quantity,
                    selling_price: order.unit_price,
                    discount: "",
                    tax: "",
                    hsn: ""
                }
            ],
            payment_method: "Prepaid",
            sub_total: order.total_amount,
            length: order.product.length || 10,
            breadth: order.product.breadth || 10,
            height: order.product.height || 10,
            weight: (order.product.weight || 0.5) * order.quantity
        }

        const createOrderResponse = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderPayload)
        })

        const shiprocketOrder = await createOrderResponse.json()

        if (!shiprocketOrder.order_id) {
            let details = ''
            if (shiprocketOrder.errors) {
                details = JSON.stringify(shiprocketOrder.errors)
            }
            console.error('Shiprocket Error:', shiprocketOrder)
            return NextResponse.json({ error: `Shiprocket Error: ${shiprocketOrder.message || 'Unknown'} ${details}` }, { status: 400 })
        }

        // 6. Generate AWB (Assign specified courier if possible)
        const awbPayload: any = {
            shipment_id: shiprocketOrder.shipment_id,
        }

        // If retailer chose a specific courier, try to assign it
        if (order.courier_company_id) {
            awbPayload.courier_id = order.courier_company_id
        }

        const awbResponse = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(awbPayload)
        })
        const awbData = await awbResponse.json()
        console.log('API: AWB Assignment Response:', JSON.stringify(awbData))

        if (!awbData.response?.data?.awb_code) {
            console.error('AWB Assignment Failed:', awbData)
            return NextResponse.json({
                error: 'AWB assignment failed',
                details: awbData.response?.data?.error || awbData.message || 'Courier might not be available for this route.'
            }, { status: 400 })
        }

        const awbCode = awbData.response.data.awb_code
        const courierName = awbData.response.data.courier_name

        // 7. Schedule Pickup
        let pickupScheduled = false
        try {
            console.log('API: Scheduling Pickup for Shipment:', shiprocketOrder.shipment_id)
            const pickupResponse = await fetch('https://apiv2.shiprocket.in/v1/external/courier/generate/pickup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    shipment_id: [shiprocketOrder.shipment_id]
                })
            })

            const pickupData = await pickupResponse.json()
            console.log('API: Pickup Response:', JSON.stringify(pickupData))
            pickupScheduled = pickupData.status === 1
        } catch (pickupErr) {
            console.error('Pickup Schedule Error (Non-Fatal):', pickupErr)
        }

        // 8. Generate Manifest
        try {
            console.log('API: Generating Manifest for Shipment:', shiprocketOrder.shipment_id)
            await fetch('https://apiv2.shiprocket.in/v1/external/manifests/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    shipment_id: [shiprocketOrder.shipment_id]
                })
            })
        } catch (manifestErr) {
            console.error('Manifest Generation Error (Non-Fatal):', manifestErr)
        }

        // 9. Update Order in Supabase
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
                shipment_id: shiprocketOrder.shipment_id,
                status: 'confirmed',
                awb_code: awbCode,
                courier_name: courierName,
                paid_at: new Date().toISOString()
            } as any)
            .eq('id', orderId)

        if (updateError) {
            console.error('Supabase update error:', updateError)
        }

        return NextResponse.json({
            success: true,
            shipment_id: shiprocketOrder.shipment_id,
            awb: awbCode,
            courier: courierName,
            pickup_scheduled: pickupScheduled
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
