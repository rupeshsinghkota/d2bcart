
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
            console.error('[WhatsApp Webhook] Failed to parse JSON body, trying URL search params')
            try {
                const params = new URLSearchParams(rawBody)
                const entries: any = {}
                for (const [key, value] of params) {
                    entries[key] = value
                }
                body = entries
                console.log('[WhatsApp Webhook] Parsed Form Data:', body)
            } catch (formError) {
                console.warn('Failed to parse as form data')
            }
        }

        // Expanded MSG91 Inbound Structure Support
        // structure can be complex: entry[0].changes[0].value.messages[0] (Meta style) or direct fields (MSG91 style)

        let messageText = body.content || body.message || body.data?.message || body.text || ""
        let mobile = body.customerNumber || body.mobile || body.data?.mobile || body.sender || body.from || body.waId || ""
        const eventName = body.eventName || ""

        // Deep check for Meta/WhatsApp Cloud API structure
        if (!messageText && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msg = body.entry[0].changes[0].value.messages[0]
            if (msg.type === 'text') {
                messageText = msg.text.body
            }
            mobile = msg.from
        }

        console.log(`[WhatsApp Webhook] Parsed - Event: ${eventName}, Mobile: ${mobile}, Message: ${messageText}`)

        if (!mobile) {
            console.warn('[WhatsApp Webhook] Missing mobile. Payload keys:', Object.keys(body))
            return NextResponse.json({ status: 'ignored', reason: 'No mobile found' })
        }

        // Treat checking for message as optional for now - if empty, assume greeting
        if (!messageText) messageText = "Hi"

        // Get AI Response (returns array of structured messages)
        const aiMessages = await getSalesAssistantResponse({
            message: messageText,
            phone: mobile
        })

        console.log(`[WhatsApp Webhook] AI Response for ${mobile}:`, aiMessages)

        // Send each message based on type
        const results = []
        for (const msg of aiMessages) {
            const cleanText = msg.text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
            console.log(`[WhatsApp Webhook] Sending to ${mobile} [${msg.type}]:`, cleanText.slice(0, 50))

            let result;
            if (msg.type === 'image' && msg.imageUrl) {
                // Use IMAGE TEMPLATE
                try {
                    result = await sendWhatsAppImageTemplate({
                        mobile: mobile,
                        imageUrl: msg.imageUrl,
                        caption: cleanText
                    })
                    if (!result.success) throw new Error(JSON.stringify(result.error))
                } catch (err) {
                    console.log('Image template failed, falling back to text', err)
                    result = await sendWhatsAppSessionMessage({
                        mobile: mobile,
                        message: cleanText
                    })
                }
            } else {
                // Use TEXT SESSION MESSAGE
                result = await sendWhatsAppSessionMessage({
                    mobile: mobile,
                    message: cleanText
                })
            }
            results.push({ type: msg.type, result })
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

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'Webhook Active' })
}
