
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSalesAssistantResponse, AIMessage } from '@/lib/gemini'
import { sendWhatsAppSessionMessage, sendWhatsAppImageTemplate } from '@/lib/msg91'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {

        const rawBody = await request.text()
        console.log('[WhatsApp Webhook] Raw Body:', rawBody)

        let body: any = {}
        try {
            body = JSON.parse(rawBody)
        } catch (e) {
            console.error('[WhatsApp Webhook] Failed to parse JSON body, trying query params logic or text')
            // Fallback for url-encoded or text
        }

        // Expanded MSG91 Inbound Structure Support
        // structure can be complex: entry[0].changes[0].value.messages[0] (Meta style) or direct fields (MSG91 style)

        let messageText = body.content || body.message || body.data?.message || body.text || ""
        let mobile = body.customerNumber || body.mobile || body.data?.mobile || body.sender || ""
        const eventName = body.eventName || ""

        // Deep check for Meta/WhatsApp Cloud API structure (sometimes MSG91 passes this through)
        if (!messageText && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msg = body.entry[0].changes[0].value.messages[0]
            if (msg.type === 'text') {
                messageText = msg.text.body
            }
            mobile = msg.from
        }

        console.log(`[WhatsApp Webhook] Parsed - Event: ${eventName}, Mobile: ${mobile}, Message: ${messageText}`)

        if (!mobile || !messageText) {
            console.warn('[WhatsApp Webhook] Missing mobile or message, ignoring.')
            return NextResponse.json({ status: 'ignored', reason: 'No mobile or message found in payload' })
        }

        // Get AI Response (returns array of structured messages)
        // ECHO TESTING
        console.log(`[WhatsApp Webhook] Echo Mode - Replying to ${mobile}`)
        const result = await sendWhatsAppSessionMessage({
            mobile: mobile,
            message: `Echo Test: ${messageText}`
        })

        return NextResponse.json({
            success: true,
            echo: true,
            msg91_result: result
        })

    } catch (error: any) {
        console.error('[WhatsApp Webhook] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'Webhook Active' })
}
