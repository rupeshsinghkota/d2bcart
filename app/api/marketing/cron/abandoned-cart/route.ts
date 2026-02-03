
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/msg91'

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // disabled for dev
        }

        // 1. Definition of "Abandoned": Updated > 1 hour ago, but less than 24 hours
        const oneHourAgo = new Date()
        oneHourAgo.setHours(oneHourAgo.getHours() - 1)

        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        // 2. Fetch Abandoned Carts
        const { data: carts, error: cartError } = await supabaseAdmin
            .from('carts')
            .select(`id, user_id, updated_at`)
            .lt('updated_at', oneHourAgo.toISOString())
            .gt('updated_at', twentyFourHoursAgo.toISOString())
            .is('recovery_sent_at', null)
            .limit(50)

        if (cartError) throw cartError
        if (!carts || carts.length === 0) {
            return NextResponse.json({ message: 'No abandoned carts found' })
        }

        // 3. Robust Fetching: Users & Items (Manual Join to avoid PGRST200)
        const userIds = [...new Set(carts.map(c => c.user_id))]
        const cartIds = carts.map(c => c.id)

        const { data: users } = await supabaseAdmin
            .from('users')
            .select('id, phone, business_name')
            .in('id', userIds)

        const userMap = (users || []).reduce((acc: any, u: any) => {
            acc[u.id] = u
            return acc
        }, {})

        const { data: cartItems } = await supabaseAdmin
            .from('cart_items')
            .select('cart_id')
            .in('cart_id', cartIds)

        const cartItemCounts = (cartItems || []).reduce((acc: any, item: any) => {
            acc[item.cart_id] = (acc[item.cart_id] || 0) + 1
            return acc
        }, {})

        const results = []

        for (const cart of carts) {
            const user = userMap[cart.user_id]
            const itemCount = cartItemCounts[cart.id] || 0

            // Skip empty carts or users without phone
            if (itemCount === 0 || !user?.phone) continue

            try {
                await sendWhatsAppMessage({
                    templateName: 'd2b_abandoned_cart',
                    mobile: user.phone,
                    components: {
                        body_1: {
                            type: 'text',
                            value: user.business_name || 'Partner'
                        }
                    }
                })

                // 4. Mark as Sent
                await supabaseAdmin
                    .from('carts')
                    .update({ recovery_sent_at: new Date().toISOString() })
                    .eq('id', cart.id)

                results.push({ id: cart.id, status: 'sent' })

            } catch (err) {
                console.error(`Failed to send recovery to ${user.phone}`, err)
                results.push({ id: cart.id, status: 'failed', error: err })
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        })

    } catch (error: any) {
        console.error('Cron Abandoned Cart Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
