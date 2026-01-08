import { NextResponse } from 'next/server'

// This route allows Supabase to send OTPs via MSG91 (WhatsApp Direct API)
// Configure this URL in Supabase -> Authentication -> Providers -> Phone -> SMS Provider: Custom
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { user, otp } = body

        if (!user || !user.phone || !otp) {
            return new NextResponse('Missing required fields', { status: 400 })
        }

        const phone = user.phone.replace('+', '') // MSG91 expects number without +

        // Environment Variables (Updated for WhatsApp Direct API)
        const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY
        // These can be hardcoded if stable, or keep in env for safety
        const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || "917557777987"
        const MSG91_NAMESPACE = process.env.MSG91_NAMESPACE || "de03d239_9cbd_4348_ad12_4d8a4ea70188"
        const MSG91_TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || "d2b_login_otp"

        if (!MSG91_AUTH_KEY) {
            console.error('MSG91_AUTH_KEY missing in env')
            return new NextResponse('MSG91 Config Missing', { status: 500 })
        }

        // WhatsApp Direct API Payload
        const payload = {
            "integrated_number": MSG91_INTEGRATED_NUMBER,
            "content_type": "template",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "template",
                "template": {
                    "name": MSG91_TEMPLATE_NAME,
                    "language": {
                        "code": "en",
                        "policy": "deterministic"
                    },
                    "namespace": MSG91_NAMESPACE,
                    "to_and_components": [
                        {
                            "to": [phone],
                            "components": {
                                "body_1": {
                                    "type": "text",
                                    "value": otp // The variable {{1}} in the template
                                }
                            }
                        }
                    ]
                }
            }
        }

        const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
            method: 'POST',
            headers: {
                'authkey': MSG91_AUTH_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()

        // MSG91 WhatsApp API usually returns { status: "success", ... } or similar
        // We log it to be sure
        console.log("MSG91 Response:", JSON.stringify(data))

        if (data.status === 'error' || data.type === 'error') {
            console.error('MSG91 Error:', data)
            return new NextResponse(JSON.stringify(data), { status: 500 })
        }

        return new NextResponse(JSON.stringify({ success: true }), { status: 200 })

    } catch (error) {
        console.error('Webhook Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
