
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/msg91'

// Initialize Supabase Admin Client (needed for Service Role to access all users data)
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
        // Security: Verify Secret Token (to prevent unauthorized triggers)
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // return new NextResponse('Unauthorized', { status: 401 })
            // For dev/testing allowing executing without secret for now, or check generic param
        }

        // 1. Find downloads older than 3 days that haven't been followed up
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

        const { data: downloads, error: downloadError } = await supabaseAdmin
            .from('catalog_downloads')
            .select(`
                id,
                user_id,
                created_at,
                category_id,
                users (
                    phone,
                    business_name
                )
            `)
            .is('followup_sent_at', null)
            .lt('created_at', threeDaysAgo.toISOString())
            .limit(50) // Process in batches

        if (downloadError) throw downloadError
        if (!downloads || downloads.length === 0) {
            return NextResponse.json({ message: 'No pending follow-ups found' })
        }

        const results = []

        // 2. Process each lead
        for (const download of downloads) {
            const user = download.users as any
            if (!user?.phone) continue

            // 3. Check for orders AFTER the download
            const { data: orders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('retailer_id', download.user_id)
                .gt('created_at', download.created_at)
                .limit(1)

            const hasConverted = orders && orders.length > 0

            if (hasConverted) {
                // User bought something! No need to nag them.
                // Mark as "handled" (sent at = now) so we don't check again
                await supabaseAdmin
                    .from('catalog_downloads')
                    .update({ followup_sent_at: new Date().toISOString() })
                    .eq('id', download.id)

                results.push({ id: download.id, status: 'skipped_converted' })
            } else {
                // 4. Send "The Closer" Message
                // Template: d2b_catalog_followup
                // Variables: {{1}} = Business/User Name
                try {
                    await sendWhatsAppMessage({
                        templateName: 'd2b_catalog_followup',
                        mobile: user.phone,
                        components: {
                            body_1: {
                                type: 'text',
                                value: user.business_name || 'there'
                            }
                        }
                    })

                    // 5. Mark as Sent
                    await supabaseAdmin
                        .from('catalog_downloads')
                        .update({ followup_sent_at: new Date().toISOString() })
                        .eq('id', download.id)

                    results.push({ id: download.id, status: 'sent' })

                } catch (err) {
                    console.error(`Failed to send follow-up to ${user.phone}`, err)
                    results.push({ id: download.id, status: 'failed', error: err })
                }
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        })

    } catch (error: any) {
        console.error('Cron Follow-up Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
