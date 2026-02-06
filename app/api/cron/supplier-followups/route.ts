/**
 * Automated Supplier Follow-up Cron Job
 * Runs daily via Vercel Cron to follow up with unresponsive suppliers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/msg91';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUPPLIER_NUMBER = process.env.SUPPLIER_WA_NUMBER || "917557777998";
const MAX_FOLLOWUPS = 3;

// Follow-up messages based on stage
const FOLLOWUP_MESSAGES = {
    initial: "Hi, this is D2BCart Sourcing Team following up. We're looking for wholesale suppliers. Could you share your product catalog?",
    catalog_received: "Thanks for your interest! Could you share your best wholesale prices and MOQ for bulk orders?",
    pricing: "We're reviewing your prices. To proceed, please share your Visiting Card or GST Certificate for vendor registration.",
    negotiating: "Hi, we're still interested in partnering with you. Let us know if you can offer better rates for bulk quantities."
};

export async function GET(request: NextRequest) {
    // Verify cron secret (Vercel Cron uses this header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Supplier Followup Cron] Starting...');

        // Find suppliers who need follow-up:
        // - Last contacted > 24 hours ago
        // - Not verified
        // - Follow-up count < MAX_FOLLOWUPS
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: suppliers, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('is_verified', false)
            .lt('follow_up_count', MAX_FOLLOWUPS)
            .or(`last_contacted_at.lt.${oneDayAgo},last_contacted_at.is.null`)
            .neq('status', 'blocked')
            .limit(20); // Process max 20 per run to avoid rate limits

        if (error) {
            console.error('[Supplier Followup Cron] Query error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!suppliers || suppliers.length === 0) {
            console.log('[Supplier Followup Cron] No suppliers to follow up');
            return NextResponse.json({ message: 'No suppliers to follow up', count: 0 });
        }

        console.log(`[Supplier Followup Cron] Found ${suppliers.length} suppliers to follow up`);

        const results = [];

        for (const supplier of suppliers) {
            try {
                // Determine appropriate message based on stage
                const stage = supplier.negotiation_stage || 'initial';
                const message = FOLLOWUP_MESSAGES[stage as keyof typeof FOLLOWUP_MESSAGES] || FOLLOWUP_MESSAGES.initial;

                // Send follow-up message
                const sendResult = await sendWhatsAppMessage({
                    mobile: supplier.phone,
                    templateName: 'd2b_ai_response', // Use approved template
                    components: {
                        body_1: { type: 'text', value: message }
                    },
                    integratedNumber: SUPPLIER_NUMBER
                });

                // Update supplier record
                await supabase
                    .from('suppliers')
                    .update({
                        follow_up_count: (supplier.follow_up_count || 0) + 1,
                        last_contacted_at: new Date().toISOString()
                    })
                    .eq('id', supplier.id);

                // Log the outbound message
                await supabase.from('whatsapp_chats').insert({
                    mobile: supplier.phone,
                    message: message,
                    direction: 'outbound',
                    status: sendResult.success ? 'sent' : 'failed',
                    metadata: { source: 'auto_followup', followup_count: supplier.follow_up_count + 1 }
                });

                results.push({
                    supplier_id: supplier.id,
                    phone: supplier.phone,
                    stage: stage,
                    success: sendResult.success
                });

                // Small delay between messages
                await new Promise(r => setTimeout(r, 1000));

            } catch (e: any) {
                console.error(`[Supplier Followup Cron] Error with ${supplier.phone}:`, e);
                results.push({
                    supplier_id: supplier.id,
                    phone: supplier.phone,
                    error: e.message
                });
            }
        }

        console.log(`[Supplier Followup Cron] Completed. Sent ${results.filter(r => r.success).length}/${results.length} follow-ups`);

        return NextResponse.json({
            message: 'Follow-ups processed',
            count: results.length,
            successful: results.filter(r => r.success).length,
            results
        });

    } catch (e: any) {
        console.error('[Supplier Followup Cron] Fatal error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
