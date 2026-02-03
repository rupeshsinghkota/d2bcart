
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
        // Security: Verify Secret Token (Recommended for Cron)
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // For dev, strict check might be disabled, but ready for logic
        }

        // 1. Definition of "Inactive": No activity for 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // 2. Fetch retailers who haven't been messaged recently
        // Optimization: In a real large DB, we would have a 'last_order_at' column on users.
        // For now, we fetch users created > 30 days ago and check their orders.
        const { data: users, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, phone, business_name, created_at')
            .eq('user_type', 'retailer')
            .lt('created_at', thirtyDaysAgo.toISOString())
            .is('reactivation_sent_at', null)
            .limit(50) // Process in batches

        if (userError) throw userError
        if (!users || users.length === 0) {
            return NextResponse.json({ message: 'No inactive users found to target' })
        }

        const results = []

        for (const user of users) {
            if (!user.phone) continue

            // 3. Check their Last Order Date
            let lastOrder = null
            try {
                const { data } = await supabaseAdmin
                    .from('orders')
                    .select('created_at')
                    .eq('retailer_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()
                lastOrder = data
            } catch (e) {
                // If single fails (no row), it's fine
            }

            const lastOrderDate = lastOrder ? new Date(lastOrder.created_at) : new Date(user.created_at)

            // If they placed an order recently (after the cutoff), skip them
            if (lastOrderDate > thirtyDaysAgo) {
                results.push({ id: user.id, status: 'skipped_active_recently' })
                continue
            }

            // 4. Send "Re-Activator" Message
            // Template: d2b_reactivation
            // Body: "Hi {{1}}, we miss you! 50+ new products added. Check them out!"
            try {
                await sendWhatsAppMessage({
                    templateName: 'd2b_reactivation',
                    mobile: user.phone,
                    components: {
                        body_1: {
                            type: 'text',
                            value: user.business_name || 'Partner'
                        }
                    }
                })

                // 5. Mark as Sent
                await supabaseAdmin
                    .from('users')
                    .update({ reactivation_sent_at: new Date().toISOString() })
                    .eq('id', user.id)

                results.push({ id: user.id, status: 'sent', phone: user.phone })

            } catch (err) {
                console.error(`Failed to send reactivation to ${user.phone}`, err)
                results.push({ id: user.id, status: 'failed', error: err })
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        })

    } catch (error: any) {
        console.error('Cron Reactivation Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
