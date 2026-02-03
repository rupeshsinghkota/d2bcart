
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSalesAssistantResponse, AIMessage } from '@/lib/gemini'
import { sendWhatsAppSessionMessage } from '@/lib/msg91'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        console.log('[WhatsApp Webhook] Received:', JSON.stringify(body))

        // MSG91 Inbound Structure
        const messageText = body.content || body.message || body.data?.message || body.text || ""
        const mobile = body.customerNumber || body.mobile || body.data?.mobile || ""
        const eventName = body.eventName || ""

        console.log(`[WhatsApp Webhook] Event: ${eventName}, Mobile: ${mobile}, Message: ${messageText}`)

        if (!mobile || !messageText) {
            return NextResponse.json({ status: 'ignored', reason: 'No mobile or message' })
        }

        // Get AI Response (returns array of structured messages)
        const aiMessages = await getSalesAssistantResponse({
            message: messageText,
            phone: mobile
        })

        console.log(`[WhatsApp Webhook] AI Response for ${mobile}:`, aiMessages)

        // Send each message based on type
        const results = []
        for (const msg of aiMessages) {
            let result;
            const cleanText = msg.text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

            if (msg.type === 'image' && msg.imageUrl) {
                // Send image with caption
                console.log(`[WhatsApp Webhook] Sending IMAGE to ${mobile}:`, msg.imageUrl)
                result = await sendWhatsAppImageMessage({
                    mobile: mobile,
                    imageUrl: msg.imageUrl,
                    caption: cleanText
                })
            } else {
                // Send text message
                console.log(`[WhatsApp Webhook] Sending TEXT to ${mobile}:`, cleanText.slice(0, 50))
                result = await sendWhatsAppSessionMessage({
                    mobile: mobile,
                    message: cleanText
                })
            }

            results.push({ type: msg.type, result })
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

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'Webhook Active' })
}
