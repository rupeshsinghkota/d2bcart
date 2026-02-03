
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSalesAssistantResponse, AIMessage } from '@/lib/gemini'
import { sendWhatsAppSessionMessage, sendWhatsAppMessage } from '@/lib/msg91'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// In-memory cache to prevent immediate loops (Container reuse)
const processedCache = new Map<string, number>();

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

        // 0. MEMORY CACHE CHECK (Fastest)
        const cacheKey = `${mobile}:${messageText}`;
        const now = Date.now();
        if (processedCache.has(cacheKey) && (now - processedCache.get(cacheKey)!) < 60000) {
            console.warn('[WhatsApp Route] Memory Cache Hit - Dropping Duplicate');
            return NextResponse.json({ status: 'ignored_memory' });
        }
        processedCache.set(cacheKey, now);

        // IDEMPOTENCY: Check db to prevent loops
        try {
            // 1. Check if processed recently
            const { data: existing } = await supabaseAdmin
                .from('whatsapp_chats')
                .select('id')
                .eq('mobile', mobile)
                .eq('message', messageText)
                .eq('direction', 'inbound')
                .gt('created_at', new Date(Date.now() - 60000).toISOString()) // 1 min check
                .limit(1)
                .single()

            if (existing) {
                console.warn('Duplicate webhook detected, ignoring.')
                return NextResponse.json({ success: true, duplicate: true })
            }

            // 2. Log Inbound
            await supabaseAdmin.from('whatsapp_chats').insert({
                mobile,
                message: messageText,
                direction: 'inbound',
                metadata: body
            })
        } catch (e) {
            console.log('Chat logging failed (Table missing?):', e)
        }

        // Get AI Response (returns array of structured messages)
        const { messages: aiMessages, escalate } = await getSalesAssistantResponse({
            message: messageText,
            phone: mobile
        })

        // Handle Escalation (Emergency Contact)
        if (escalate) {
            const adminMobile = "919155149597"; // Chandan
            console.log(`[WhatsApp Webhook] Escalating ${mobile} to Admin ${adminMobile}`);

            const alertText = `SUPPORT REQ: From ${mobile}. Msg: ${messageText.slice(0, 100)}`;

            // Send Alert to Admin using a TEMPLATE (Template delivers even if no session)
            // Using d2b_abandoned_cart as it is verified working in CRON
            const alertResult = await sendWhatsAppMessage({
                mobile: adminMobile,
                templateName: 'd2b_abandoned_cart',
                components: {
                    body_1: { type: 'text', value: alertText }
                }
            }).catch(e => {
                console.error("Escalation failed", e);
                return { success: false, error: e };
            });

            // Log the alert to DB so it shows up in dashboard
            try {
                await supabaseAdmin.from('whatsapp_chats').insert({
                    mobile: adminMobile,
                    message: alertText,
                    direction: 'outbound',
                    status: alertResult.success ? 'sent' : 'failed',
                    metadata: { type: 'escalation_alert', ...alertResult }
                });
            } catch (dbErr) {
                console.error("Failed to log alert to DB", dbErr);
            }
        }

        console.log(`[WhatsApp Webhook] AI Response for ${mobile}:`, aiMessages)

        // Send each message based on type
        const results = []
        for (const msg of aiMessages) {
            const cleanText = msg.text.trim()
            console.log(`[WhatsApp Webhook] Sending to ${mobile} [${msg.type}]:`, cleanText.slice(0, 50))

            // Unified Session Message Logic (Supports Text & Images directly)
            const result = await sendWhatsAppSessionMessage({
                mobile: mobile,
                message: cleanText,
                imageUrl: (msg.type === 'image' && msg.imageUrl) ? msg.imageUrl : undefined
            })

            // Log Outbound
            try {
                await supabaseAdmin.from('whatsapp_chats').insert({
                    mobile,
                    message: cleanText,
                    direction: 'outbound',
                    status: result.success ? 'sent' : 'failed',
                    metadata: result
                })
            } catch (e) { }

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
