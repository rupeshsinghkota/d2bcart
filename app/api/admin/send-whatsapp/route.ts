/**
 * Admin API to send manual WhatsApp messages
 * This logs the message properly so Human Takeover works correctly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppSessionMessage } from '@/lib/msg91';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CUSTOMER_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || "917557777987";
const SUPPLIER_NUMBER = process.env.SUPPLIER_WA_NUMBER || "917557777998";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { mobile, message, line } = body;

        if (!mobile || !message) {
            return NextResponse.json({ error: 'mobile and message required' }, { status: 400 });
        }

        // Determine which number to send from
        const integratedNumber = line === 'supplier' ? SUPPLIER_NUMBER : CUSTOMER_NUMBER;

        // Send the message via MSG91
        const result = await sendWhatsAppSessionMessage({
            mobile,
            message,
            integratedNumber
        });

        // Log it as a MANUAL message - this will trigger Human Takeover!
        await supabase.from('whatsapp_chats').insert({
            mobile,
            message,
            direction: 'outbound',
            status: result.success ? 'sent' : 'failed',
            metadata: {
                source: 'manual_admin', // This triggers takeover!
                line: line || 'customer',
                ...result
            }
        });

        console.log(`[Admin Send] Manual message sent to ${mobile} from ${line || 'customer'} line. Takeover activated.`);

        return NextResponse.json({
            success: result.success,
            message: 'Sent and logged as manual (AI paused for 4h)',
            result
        });

    } catch (e: any) {
        console.error('[Admin Send] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
