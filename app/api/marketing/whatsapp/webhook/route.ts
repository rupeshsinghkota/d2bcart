
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

        // MSG91 Inbound Structure (usually nested in 'data' or root)
        // Adjust these based on MSG91's actual payload format for incoming messages
        const messageText = body.message || body.data?.message || body.text || ""
        const mobile = body.mobile || body.data?.mobile || ""

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

        // 2. Get AI Response
        const aiResponse = await getSalesAssistantResponse({
            message: messageText,
            context: `User Name: ${userName}. They are messaging from WhatsApp.`
        })

        console.log(`[WhatsApp Webhook] AI Response for ${mobile}: ${aiResponse}`)

        // 3. Send Response via MSG91 (Using template since bulk API only supports templates)
        // You need to create a template 'd2b_ai_response' with body: "{{1}}"
        const result = await sendWhatsAppMessage({
            mobile: mobile,
            templateName: 'd2b_ai_response',
            components: {
                body_1: { type: 'text', value: aiResponse }
            }
        })

        return NextResponse.json({
            success: true,
            ai_response: aiResponse,
            msg91_result: result
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
