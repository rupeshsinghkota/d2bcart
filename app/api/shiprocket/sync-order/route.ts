import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    // Initialize Admin Supabase Client
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
        const { orderId } = await req.json()
        if (!orderId) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })

        // 1. Get order details
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        if (!order.awb_code && !order.shipment_id) {
            return NextResponse.json({ error: 'Order has no AWB or Shipment ID to sync' }, { status: 400 })
        }

        // 2. Auth with ShipRocket
        const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: process.env.SHIPROCKET_EMAIL,
                password: process.env.SHIPROCKET_PASSWORD
            })
        })
        const authData = await authRes.json()
        if (!authData.token) throw new Error('Shiprocket auth failed')
        const token = authData.token

        // 3. Fetch Tracking Data
        let srStatus = ''
        let debugInfo: any = {}

        if (order.awb_code) {
            const trackRes = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${order.awb_code}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const trackData = await trackRes.json()
            debugInfo.track = trackData

            // Strategy: Use AWB to SEARCH for the Order directly.
            // This bypasses the issue where we don't have the SR Order ID.
            if (trackData.tracking_data) {
                const awbSearchRes = await fetch(`https://apiv2.shiprocket.in/v1/external/orders?search=${order.awb_code}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const awbSearchData = await awbSearchRes.json()
                debugInfo.search = awbSearchData

                // If search found the order, use its status as the Truth
                if (awbSearchData.data && awbSearchData.data.length > 0) {
                    const srOrder = awbSearchData.data[0]
                    debugInfo.srOrder = srOrder // Log for debugging

                    if (srOrder.status) {
                        const internalStatus = srOrder.status.toUpperCase()
                        if (internalStatus.includes('CANCEL') || internalStatus === 'CANCELED') {
                            srStatus = 'CANCELLED'
                        } else if (internalStatus === 'NEW') {
                            // If tracking says "Shipped" but Dashboard says "New", trust tracking usually?
                            // But for Cancellation, Dashboard is authority.
                        }
                    }
                }

                // If AWB search failed, try searching by Channel Order ID (Order Number)
                if (!srStatus && (!awbSearchData.data || awbSearchData.data.length === 0)) {
                    const orderNumSearchRes = await fetch(`https://apiv2.shiprocket.in/v1/external/orders?search=${order.order_number}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                    const orderNumData = await orderNumSearchRes.json()
                    debugInfo.searchOrderNum = orderNumData

                    if (orderNumData.data && orderNumData.data.length > 0) {
                        const srOrder = orderNumData.data[0]
                        debugInfo.srOrder = srOrder
                        if (srOrder.status) {
                            // Capture the status string directly so main logic can map 'NEW' -> 'pending'
                            srStatus = srOrder.status
                        }
                    }
                }

                // If not already overridden by Order Search, check Tracking Status
                if (!srStatus) {
                    if (trackData.tracking_data.track_status) {
                        const statusCode = trackData.tracking_data.shipment_status
                        const currentStatus = trackData.tracking_data.shipment_track?.[0]?.current_status || ''
                        debugInfo.statusCode = statusCode
                        debugInfo.currentStatus = currentStatus

                        // Prioritize CANCELLATION check
                        const upperCurrent = currentStatus.toUpperCase()

                        if (statusCode === 8 || statusCode === 18 || upperCurrent.includes('CANCEL')) {
                            srStatus = 'CANCELLED'
                        } else if (statusCode === 7) srStatus = 'DELIVERED'
                        else if (statusCode === 6) srStatus = 'SHIPPED'
                        else if (statusCode === 9) srStatus = 'RTO INITIATED'
                        else if (statusCode === 10) srStatus = 'RTO DELIVERED'
                        else if (currentStatus) {
                            srStatus = currentStatus
                        }
                    }
                }
            }
        }

        // Fallback if no AWB or Tracking failed to find status
        if (!srStatus && order.shipment_id) {
            const showRes = await fetch(`https://apiv2.shiprocket.in/v1/external/orders/show/${order.shipment_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const showData = await showRes.json()
            debugInfo.show = showData
            if (showData.data && showData.data.status) {
                srStatus = showData.data.status
            }
        }

        console.log(`Syncing Order ${orderId}: SR Status '${srStatus}' (Current: ${order.status})`, debugInfo)

        // 4. Map to local status
        let localStatus = order.status
        const upperStatus = srStatus.toUpperCase()

        if (upperStatus.includes('CANCEL')) localStatus = 'cancelled'
        else if (upperStatus.includes('DELIVERED') && !upperStatus.includes('RTO')) localStatus = 'delivered'
        else if (upperStatus.includes('RTO') && upperStatus.includes('DELIVERED')) localStatus = 'rto_delivered'
        else if (upperStatus.includes('RTO')) localStatus = 'rto_initiated'
        else if (upperStatus.includes('SHIPPED') || upperStatus.includes('TRANSIT')) localStatus = 'shipped'
        else if (upperStatus.includes('PICKED UP')) localStatus = 'shipped'
        else if (upperStatus.includes('READY TO SHIP')) localStatus = 'confirmed'
        else if (upperStatus.includes('READY TO SHIP')) localStatus = 'confirmed'
        else if (upperStatus === 'NEW') localStatus = 'cancelled' // User explicitly requested NEW (Voided) to show as Cancelled

        // 5. Update DB if changed
        // Critical: Update ALL orders in the same shipment/AWB, not just the single item.
        if (localStatus !== order.status) {
            let updateQuery = supabase.from('orders').update({
                status: localStatus,
                ...(localStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {})
            })

            if (order.shipment_id) {
                updateQuery = updateQuery.eq('shipment_id', order.shipment_id)
            } else if (order.awb_code) {
                updateQuery = updateQuery.eq('awb_code', order.awb_code)
            } else {
                updateQuery = updateQuery.eq('id', orderId)
            }

            const { error: updateError } = await updateQuery

            if (updateError) throw updateError

            return NextResponse.json({
                success: true,
                oldStatus: order.status,
                newStatus: localStatus,
                scope: order.shipment_id ? 'shipment' : 'single',
                srStatus,
                debug: debugInfo
            })
        }

        return NextResponse.json({
            success: true,
            status: localStatus,
            message: 'Status up to date',
            srStatus,
            debug: debugInfo
        })

    } catch (error: any) {
        console.error('Sync Error:', error)
        return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 })
    }
}
