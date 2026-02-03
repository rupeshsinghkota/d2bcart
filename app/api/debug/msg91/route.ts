
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/msg91'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        console.log('[Debug] Starting MSG91 Test...');

        const mobile = "917557777987"; // Use the integrated number or a safe fallback
        const templateName = "d2b_daily_text_v1";

        const payload = {
            mobile,
            templateName,
            components: {
                // Mimic the exact structure used in route.ts
                body_1: { type: 'text', value: 'DebugUser' },
                body_2: { type: 'text', value: 'DebugCategory' },
                body_3: { type: 'text', value: 'https://d2bcart.com/debug' }
            }
        };

        // Call the library function
        const result = await sendWhatsAppMessage(payload);

        return NextResponse.json({
            status: 'Test Executed',
            input: payload,
            result: result
        })
    } catch (error: any) {
        return NextResponse.json({
            status: 'Test Failed',
            error: error.message || error
        }, { status: 500 })
    }
}
