
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSalesAssistantResponse } from '@/lib/gemini'
import { sendWhatsAppMessage } from '@/lib/msg91'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        console.log('[WhatsApp Webhook] Received:', JSON.stringify(body))

        // MSG91 Inbound Structure based on their webhook payload format
        // They send: customerNumber, content, eventName, etc.
        const messageText = body.content || body.message || body.data?.message || body.text || ""
        const mobile = body.customerNumber || body.mobile || body.data?.mobile || ""
        const eventName = body.eventName || ""

        console.log(`[WhatsApp Webhook] Event: ${eventName}, Mobile: ${mobile}, Message: ${messageText}`)

        if (!mobile || !messageText) {
            return NextResponse.json({ status: 'ignored', reason: 'No mobile or message' })
        }

        // 1. Identify User (Optional: Fetch context from DB)
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('business_name')
            .eq('phone', mobile)
            .single()

        const userName = user?.business_name || 'Retailer'

        // 2. Get AI Response with customer context (returns array of messages)
        const aiMessages = await getSalesAssistantResponse({
            message: messageText,
            phone: mobile
        })

        console.log(`[WhatsApp Webhook] AI Response for ${mobile}:`, aiMessages)

        // 3. Send each message via MSG91 (strip newlines for compatibility)
        const results = []
        for (const msg of aiMessages) {
            const cleanMsg = msg.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
            const result = await sendWhatsAppMessage({
                mobile: mobile,
                templateName: 'd2b_ai_response',
                components: {
                    body_1: { type: 'text', value: cleanMsg }
                }
            })
            results.push(result)
            // Small delay between messages
            await new Promise(r => setTimeout(r, 500))
        }

        return NextResponse.json({
            success: true,
            ai_responses: aiMessages,
            msg91_results: results
        })

    } catch (error: any) {
        console.error('[WhatsApp Webhook] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * Handle GET for verification if MSG91 requires it (like Meta does)
 */
export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'Webhook Active' })
}
