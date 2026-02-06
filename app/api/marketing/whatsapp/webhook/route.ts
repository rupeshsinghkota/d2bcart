
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

        const rawBody = await request.text();
        console.log('[WhatsApp Webhook] Raw Body:', rawBody);



        // DEBUG: Log everything to DB to find "Hidden" user events
        try {
            await supabaseAdmin.from('debug_webhook_events').insert({
                payload: JSON.parse(rawBody)
            });
        } catch (e) {
            console.error('Debug Log Failed:', e);
        }

        // FALLBACK DEBUG: Also log raw webhook to whatsapp_chats for inspection
        try {
            const parsed = JSON.parse(rawBody);
            await supabaseAdmin.from('whatsapp_chats').insert({
                mobile: '000_DEBUG_RAW',
                message: `Keys: ${Object.keys(parsed).join(',')} | status: ${parsed.status} | message_uuid: ${parsed.message_uuid} | direction: ${parsed.direction}`,
                direction: 'inbound',
                metadata: { source: 'raw_webhook_debug', payload: parsed }
            });
        } catch (e) { /* ignore */ }

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

        // ============================================================
        // OUTBOUND CHECK FIRST - Must run before any inbound processing
        // MSG91 sends direction:1 for outbound events (including manual dashboard messages)
        // ============================================================
        const directionValue = body.direction;
        const isDirectionOutbound = directionValue === 1 || directionValue === '1' || directionValue === 'outbound';
        const outboundStatuses = ['sent', 'delivered', 'read', 'failed', 'dispatched', 'queued'];
        const msgStatus = body.status || body.message_status;

        const isOutboundEvent = isDirectionOutbound || (msgStatus && outboundStatuses.includes(msgStatus));

        if (isOutboundEvent) {
            const outUuid = body.wamid || body.uuid || body.message_uuid || body.id || body.msg_id;
            const outMobile = body.customerNumber || body.mobile || body.recipient_id || body.customer_number || body.destination || "";
            const cleanMobile = outMobile.replace('+', '').replace(/\s/g, '');

            console.log(`[WhatsApp Webhook] 📤 Outbound Event Detected! Direction: ${directionValue}, Status: ${msgStatus}, Mobile: ${outMobile}, Text: "${body.text || '[none]'}"`);

            // TEXT-BASED DETECTION: Manual dashboard messages have text content in direction:1 events
            // API delivery reports do NOT have text content - only status/direction fields
            const hasTextContent = body.text && typeof body.text === 'string' && body.text.trim().length > 0;

            if (cleanMobile && isDirectionOutbound && hasTextContent) {
                // This is a MANUAL message sent from MSG91 Dashboard!
                console.log(`[WhatsApp Webhook] 🛑 MANUAL Outbound Detected! Text: "${body.text}" for ${cleanMobile}. Pausing AI for 4h.`);

                await supabaseAdmin.from('whatsapp_chats').insert({
                    mobile: cleanMobile,
                    message: `[Manual: ${body.text.slice(0, 50)}] - AI Paused 4h`,
                    direction: 'outbound',
                    status: 'sent',
                    metadata: { source: 'manual_detected', wamid: outUuid, originalText: body.text }
                });

                return NextResponse.json({ status: 'registered_manual_takeover' });
            }

            // Delivery reports (no text content) - ignore silently
            console.log(`[WhatsApp Webhook] Ignoring outbound delivery report.`);
            return NextResponse.json({ status: 'ignored_outbound' });
        }

        // ============================================================
        // INBOUND MESSAGE PROCESSING (Only if NOT outbound)
        // ============================================================

        // Expanded MSG91/Meta Inbound Structure Support
        let messageText = body.content || body.message || body.data?.message || body.text || ""
        let mobile = body.customerNumber || body.mobile || body.data?.mobile || body.sender || body.from || body.waId || ""
        // Fix: MSG91 sends it as 'integratedNumber' (camelCase)
        let receiver = body.receiver || body.integratedNumber || body.integrated_number || body.display_phone_number || ""
        const eventName = body.eventName || ""

        // Deep check for Meta/WhatsApp Cloud API structure
        if (!messageText && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const msg = body.entry[0].changes[0].value.messages[0]
            if (msg.type === 'text') {
                messageText = msg.text.body
            }
            mobile = msg.from
            // Try to find receiver in Meta payload
            const metadata = body.entry[0].changes[0].value.metadata
            if (metadata && metadata.display_phone_number) {
                receiver = metadata.display_phone_number
            }
        }

        console.log(`[WhatsApp Webhook] Parsed - Event: ${eventName}, Mobile: ${mobile}, Receiver: ${receiver}, Message: ${messageText}`)

        if (!mobile) {
            console.warn('[WhatsApp Webhook] Missing mobile. Payload keys:', Object.keys(body))
            return NextResponse.json({ status: 'ignored', reason: 'No mobile found' })
        }

        // 🛑 LOOP PREVENTION 1: Ignore messages that look like JSON (Outbound Echoes)
        if (typeof messageText === 'string' && (messageText.trim().startsWith('{') || messageText.includes('"text":'))) {
            console.warn('[WhatsApp Webhook] Ignored JSON-like message text (Outbound Echo Loop):', messageText);
            return NextResponse.json({ status: 'ignored_loop_json' });
        }

        // 🛑 LOOP PREVENTION 2: Ignore messages FROM our own numbers
        const OWN_NUMBERS = [
            process.env.MSG91_INTEGRATED_NUMBER,
            process.env.SUPPLIER_WA_NUMBER,
            receiver,
            "917557777998",
            "917557777987"
        ];
        if (OWN_NUMBERS.includes(mobile)) {
            console.warn('[WhatsApp Webhook] Ignored message FROM own number (Self-Loop):', mobile);
            return NextResponse.json({ status: 'ignored_own_number' });
        }

        // ============================================================
        // INBOUND MESSAGE PROCESSING CONTINUES (Outbound already filtered above)
        // ============================================================
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
            const { data: existing } = await supabaseAdmin
                .from('whatsapp_chats')
                .select('id')
                .eq('mobile', mobile)
                .eq('message', messageText)
                .eq('direction', 'inbound')
                .gt('created_at', new Date(Date.now() - 60000).toISOString())
                .limit(1)
                .single()

            if (existing) {
                console.warn('Duplicate webhook detected, ignoring.')
                return NextResponse.json({ success: true, duplicate: true })
            }

            await supabaseAdmin.from('whatsapp_chats').insert({
                mobile,
                message: messageText,
                direction: 'inbound',
                metadata: body
            })
        } catch (e) {
            console.log('Chat logging failed (Table missing?):', e)
        }

        // (Outbound interceptor already ran above)

        // ============================================================
        // ROUTING LOGIC: SUPPLIER vs CUSTOMER
        // ============================================================
        // Check if the message was sent to the SUPPLIER LINE
        // You can define this in ENV or just check the number directly
        const SUPPLIER_NUMBER = process.env.SUPPLIER_WA_NUMBER || "917557777998"; // Updated to user's supplier number

        let isSupplierFlow = false;
        if (receiver && receiver.includes(SUPPLIER_NUMBER)) {
            isSupplierFlow = true;
        }

        if (isSupplierFlow) {
            console.log(`[WhatsApp Webhook] 🟢 Routing to SOURCING AGENT (Receiver: ${receiver})`);

            // AUTO-SAVE LOGIC: If this is a supplier replying, ensure they are in our DB
            try {
                const { data: existingSup } = await supabaseAdmin
                    .from('suppliers')
                    .select('id, status')
                    .eq('phone', mobile)
                    .single();

                if (!existingSup) {
                    // New Supplier Responding! Save them.
                    await supabaseAdmin.from('suppliers').insert({
                        name: `Supplier ${mobile.slice(-4)}`, // Temporary name until we know
                        phone: mobile,
                        status: 'responded',
                        source: 'whatsapp_inbound',
                        notes: 'Auto-saved on first reply'
                    });
                    console.log(`[WhatsApp Webhook] Auto-saved new supplier: ${mobile}`);
                } else if (existingSup.status === 'discovered') {
                    // Update status to responded
                    await supabaseAdmin.from('suppliers')
                        .update({ status: 'responded', updated_at: new Date() })
                        .eq('id', existingSup.id);
                }
            } catch (err) {
                console.error('[WhatsApp Webhook] Failed to auto-save supplier:', err);
            }

            // CHECK FOR HUMAN TAKEOVER (Pause AI if manual message sent in last 4h)
            // IMPORTANT: Only check for ACTUAL manual messages, not messages from other AI bots
            try {
                const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
                const { data: recentHumanOutbound } = await supabaseAdmin
                    .from('whatsapp_chats')
                    .select('id, message, metadata')
                    .eq('mobile', mobile)
                    .eq('direction', 'outbound')
                    .gt('created_at', fourHoursAgo)
                    // Only block on ACTUAL MANUAL messages: source is null OR starts with 'manual'
                    .or('metadata->>source.is.null,metadata->>source.ilike.manual%')
                    .limit(1);

                if (recentHumanOutbound && recentHumanOutbound.length > 0) {
                    const triggerMsg = recentHumanOutbound[0];
                    console.log(`[WhatsApp Webhook] 🛑 Sourcing Agent Paused. Manual Chat detected for ${mobile}. Last msg: "${triggerMsg.message?.slice(0, 50)}..."`);
                    return NextResponse.json({ status: 'ignored_human_takeover_supplier', trigger_id: triggerMsg.id });
                }
            } catch (e) {
                console.error('Supplier Takeover check failed:', e);
            }

            // LAZY IMPORT TO AVOID CIRCULAR DEPS IF ANY
            const { getSourcingAgentResponse } = await import('@/lib/sourcing_agent');

            // Extract image URL if present (MSG91 sends 'url' for images)
            const imageUrl = body.url || body.attachment_url || body.media_url || undefined;
            if (imageUrl) {
                console.log(`[WhatsApp Webhook] 📷 Image detected for Sourcing Agent: ${imageUrl}`);
            }

            const aiResult = await getSourcingAgentResponse({
                message: messageText || '[Image received]',
                phone: mobile,
                imageUrl: imageUrl
            });

            console.log(`[WhatsApp Webhook] Sourcing Agent v2 Action: ${aiResult.action}, Reply: ${aiResult.message}`);

            // Update supplier record with extracted data (Vision AI results)
            if (aiResult.update_supplier || aiResult.extracted_data) {
                try {
                    const updateData: any = {
                        last_contacted_at: new Date().toISOString()
                    };

                    if (aiResult.update_supplier) {
                        if (aiResult.update_supplier.last_quoted_price) updateData.last_quoted_price = aiResult.update_supplier.last_quoted_price;
                        if (aiResult.update_supplier.negotiation_stage) updateData.negotiation_stage = aiResult.update_supplier.negotiation_stage;
                        if (aiResult.update_supplier.conversation_summary) updateData.conversation_summary = aiResult.update_supplier.conversation_summary;
                        if (aiResult.update_supplier.deal_score) updateData.deal_score = aiResult.update_supplier.deal_score;
                    }

                    if (aiResult.extracted_data?.gst_number) {
                        updateData.gst_number = aiResult.extracted_data.gst_number;
                        updateData.is_verified = true;
                    }

                    await supabaseAdmin
                        .from('suppliers')
                        .update(updateData)
                        .eq('phone', mobile);

                    console.log(`[WhatsApp Webhook] Updated supplier record:`, updateData);
                } catch (e) {
                    console.error('[WhatsApp Webhook] Failed to update supplier:', e);
                }
            }

            // Send Reply via Supplier Number
            const result = await sendWhatsAppSessionMessage({
                mobile: mobile,
                message: aiResult.message,
                integratedNumber: SUPPLIER_NUMBER // Important: Reply from same line
            });

            // Log Outbound
            try {
                await supabaseAdmin.from('whatsapp_chats').insert({
                    mobile,
                    message: aiResult.message,
                    direction: 'outbound',
                    status: result.success ? 'sent' : 'failed',
                    metadata: { ...result, source: 'sourcing_agent', action: aiResult.action, extracted: aiResult.extracted_data }
                })
            } catch (e) { }

            return NextResponse.json({ success: true, agent: 'sourcing', result });

        } else {
            // ============================================================
            // CUSTOMER SALES FLOW - Completely Separate from Supplier Flow
            // ============================================================
            const CUSTOMER_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || "917557777987";
            console.log(`[WhatsApp Webhook] 🔵 Routing to SALES ASSISTANT (Via: ${CUSTOMER_NUMBER})`);

            // 0.A CHECK FOR "UNKNOWN CONTEXT" (Reply to a message we didn't send?)
            // If the user replies to a specific message, Meta sends 'context'.
            // If that context ID is NOT in our DB, it implies the User sent it manually from Mobile/Dashboard.
            try {
                // Try to extract context ID from various payload structures
                let contextId = body.context?.id ||
                    body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.context?.id ||
                    body.reply_to_message_id; // MSG91 might normalize this

                if (contextId) {
                    const { data: knownMsg } = await supabaseAdmin
                        .from('whatsapp_chats')
                        .select('id')
                        .or(`metadata->>messageId.eq.${contextId},metadata->data->>message_uuid.eq.${contextId}`)
                        .single();

                    if (!knownMsg) {
                        console.log(`[WhatsApp Webhook] 🛑 Supply Agent Paused. User replied to Unknown Message (ID: ${contextId}). Assuming Human Manual Chat.`);

                        // Insert a placeholder "Manual Message" to ensure the 4h blocking logic persists for future messages
                        await supabaseAdmin.from('whatsapp_chats').insert({
                            mobile: mobile,
                            message: "[Manual Intervention Detected via Context]",
                            direction: 'outbound',
                            status: 'sent',
                            metadata: { source: 'manual_app_inference', context_id: contextId }
                        });

                        return NextResponse.json({ status: 'ignored_human_takeover_context', context_id: contextId });
                    }
                }
            } catch (e) {
                console.error("Context check error:", e);
            }

            // 0.B CHECK FOR HUMAN TAKEOVER (Pause AI if manual message sent in last 4h)
            try {
                const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
                const { data: recentHumanOutbound } = await supabaseAdmin
                    .from('whatsapp_chats')
                    .select('id, message, metadata')
                    .eq('mobile', mobile)
                    .eq('direction', 'outbound')
                    .gt('created_at', fourHoursAgo)
                    // Only block on ACTUAL MANUAL messages: source is null OR starts with 'manual'
                    .or('metadata->>source.is.null,metadata->>source.ilike.manual%')
                    .limit(1);

                if (recentHumanOutbound && recentHumanOutbound.length > 0) {
                    const triggerMsg = recentHumanOutbound[0];
                    console.log(`[WhatsApp Webhook] Human Takeover detected for ${mobile}. Triggered by msg: "${triggerMsg.message?.slice(0, 50)}..." (ID: ${triggerMsg.id})`);
                    return NextResponse.json({ status: 'ignored_human_takeover', trigger_id: triggerMsg.id });
                }
            } catch (e) {
                console.error('Takeover check failed:', e);
            }

            const { messages: aiMessages, escalate } = await getSalesAssistantResponse({
                message: messageText,
                phone: mobile
            })

            // Handle Escalation
            if (escalate) {
                const adminMobile = "919155149597";
                const alertText = `SUPPORT REQ: From ${mobile}. Msg: ${messageText.slice(0, 100)}`;

                try {
                    // Send first, capture the response with UUID
                    const alertResult = await sendWhatsAppMessage({
                        mobile: adminMobile,
                        templateName: 'd2b_ai_response',
                        components: { body_1: { type: 'text', value: alertText } }
                    });

                    // Log AFTER sending, including the response (which contains message_uuid)
                    await supabaseAdmin.from('whatsapp_chats').insert({
                        mobile: adminMobile,
                        message: alertText,
                        direction: 'outbound',
                        status: alertResult.success ? 'sent' : 'failed',
                        metadata: { ...alertResult, source: 'system_alert' }
                    });
                } catch (e) {
                    console.error('Escalation failed:', e);
                }
            }

            const results = []
            for (const msg of aiMessages) {
                const cleanText = msg.text.trim()
                const result = await sendWhatsAppSessionMessage({
                    mobile: mobile,
                    message: cleanText,
                    imageUrl: (msg.type === 'image' && msg.imageUrl) ? msg.imageUrl : undefined,
                    integratedNumber: CUSTOMER_NUMBER // Explicit: Reply from Customer Line
                })
                await supabaseAdmin.from('whatsapp_chats').insert({
                    mobile,
                    message: cleanText,
                    direction: 'outbound',
                    status: result.success ? 'sent' : 'failed',
                    metadata: { ...result, source: 'ai_assistant' }
                })

                results.push({ type: msg.type, result })
                await new Promise(r => setTimeout(r, 500))
            }

            return NextResponse.json({ success: true, ai_responses: aiMessages, msg91_results: results })
        }

    } catch (error: any) {
        console.error('[WhatsApp Webhook] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'Webhook Active' })
}
