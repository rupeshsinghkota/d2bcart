
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
    // Security Check
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // disabled
    }

    const report = {
        followup: { processed: 0, sent: 0, errors: 0 },
        reactivation: { processed: 0, sent: 0, errors: 0 }
    }

    try {
        // --- PART 1: CATALOG FOLLOW-UP (The Closer) ---
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

        const { data: downloads } = await supabaseAdmin
            .from('catalog_downloads')
            .select(`id, user_id, created_at, users (phone, business_name)`)
            .is('followup_sent_at', null)
            .lt('created_at', threeDaysAgo.toISOString())
            .limit(25) // Smaller batch to fit timeout

        if (downloads) {
            for (const download of downloads) {
                const user = download.users as any
                if (!user?.phone) continue

                // Check conversion
                const { data: orders } = await supabaseAdmin.from('orders').select('id').eq('retailer_id', download.user_id).gt('created_at', download.created_at).limit(1)

                if (orders && orders.length > 0) {
                    // Converted
                    await supabaseAdmin.from('catalog_downloads').update({ followup_sent_at: new Date().toISOString() }).eq('id', download.id)
                } else {
                    // Send Message
                    try {
                        await sendWhatsAppMessage({
                            mobile: user.phone,
                            templateName: 'd2b_catalog_followup',
                            components: { body_1: { type: 'text', value: user.business_name || 'there' } }
                        })
                        await supabaseAdmin.from('catalog_downloads').update({ followup_sent_at: new Date().toISOString() }).eq('id', download.id)
                        report.followup.sent++
                    } catch (e) { report.followup.errors++ }
                }
                report.followup.processed++
            }
        }

        // --- PART 2: REACTIVATION (The Re-Activator) ---
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: users } = await supabaseAdmin
            .from('users')
            .select('id, phone, business_name, created_at')
            .eq('user_type', 'retailer')
            .lt('created_at', thirtyDaysAgo.toISOString())
            .is('reactivation_sent_at', null)
            .limit(25)

        if (users) {
            for (const user of users) {
                if (!user.phone) continue

                const { data: lastOrder } = await supabaseAdmin.from('orders').select('created_at').eq('retailer_id', user.id).order('created_at', { ascending: false }).limit(1).single()
                const lastOrderDate = lastOrder ? new Date(lastOrder.created_at) : new Date(user.created_at)

                if (lastOrderDate < thirtyDaysAgo) {
                    try {
                        await sendWhatsAppMessage({
                            mobile: user.phone,
                            templateName: 'd2b_reactivation',
                            components: { body_1: { type: 'text', value: user.business_name || 'Partner' } }
                        })
                        await supabaseAdmin.from('users').update({ reactivation_sent_at: new Date().toISOString() }).eq('id', user.id)
                        report.reactivation.sent++
                    } catch (e) { report.reactivation.errors++ }
                }
                report.reactivation.processed++
            }
        }

        return NextResponse.json({ success: true, report })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
