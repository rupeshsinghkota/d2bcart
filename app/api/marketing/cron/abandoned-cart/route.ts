
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
        // We select carts where user has NOT been messaged yet
        const { data: carts, error: cartError } = await supabaseAdmin
            .from('carts')
            .select(`
                id,
                user_id,
                updated_at,
                users (
                    phone,
                    business_name
                ),
                cart_items (
                    id
                )
            `)
            .lt('updated_at', oneHourAgo.toISOString())
            .gt('updated_at', twentyFourHoursAgo.toISOString())
            .is('recovery_sent_at', null)
            .limit(50)

        if (cartError) throw cartError
        if (!carts || carts.length === 0) {
            return NextResponse.json({ message: 'No, abandoned carts found' })
        }

        const results = []

        for (const cart of carts) {
            const user = cart.users as any
            const items = cart.cart_items || []

            // Skip empty carts or users without phone
            if (items.length === 0 || !user?.phone) continue

            // 3. Send "Recovery" Message
            // Template: d2b_abandoned_cart
            // Body: "Hi {{1}}, you have items waiting in your cart! Complete your order now: {{2}}"
            // {{1}} = Name
            // {{2}} = Cart Link (e.g., https://d2bcart.com/cart)
            try {
                await sendWhatsAppMessage({
                    templateName: 'd2b_abandoned_cart',
                    mobile: user.phone,
                    components: {
                        body_1: {
                            type: 'text',
                            value: user.business_name || 'Partner'
                        },
                        body_2: {
                            type: 'text',
                            value: 'https://d2bcart.com/cart'
                        },
                        button_1: {
                            subtype: 'url',
                            type: 'text',
                            value: 'cart' // Suffix for https://d2bcart.com/{{1}}
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
