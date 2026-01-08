import { NextResponse } from 'next/server'

// This route allows Supabase to send OTPs via MSG91 (WhatsApp Direct API)
// Configure this URL in Supabase -> Authentication -> Providers -> Phone -> SMS Provider: Custom
// This route allows Supabase to send OTPs via MSG91 (WhatsApp Direct API)
// Configure this URL in Supabase -> Authentication -> Providers -> Phone -> SMS Provider: Custom
export async function POST(request: Request) {
    console.log('--- MSG91 Hook Triggered ---')
    try {
        let body
        try {
            body = await request.json()
            console.log('Hook Payload:', JSON.stringify(body, null, 2))
        } catch (e) {
            console.error('Failed to parse JSON body')
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        // Supabase sometimes sends 'otp' at root, sometimes nested in 'sms' object
        const otp = body.otp || body.token || body.code || body.sms?.otp || body.sms?.token || body.sms?.code
        const { user } = body

        if (!user || !user.phone || !otp) {
            console.error('Missing required fields:', {
                user: !!user,
                phone: !!user?.phone,
                otp_found: !!otp,
                available_keys: Object.keys(body)
            })
            // Return 200 to prevent Supabase "Invalid Payload" error, so we can debug logs
            return NextResponse.json({ error: 'Missing required fields (Logged)' }, { status: 200 })
        }

        const phone = user.phone.replace('+', '') // MSG91 expects number without +

        // Environment Variables
        const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY
        // Defaults
        const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || "917557777987"
        const MSG91_NAMESPACE = process.env.MSG91_NAMESPACE || "de03d239_9cbd_4348_ad12_4d8a4ea70188"
        const MSG91_TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || "d2b_login_otp"

        if (!MSG91_AUTH_KEY) {
            console.error('CRITICAL: MSG91_AUTH_KEY missing in server environment')
            return NextResponse.json({ error: 'Server Config Missing' }, { status: 500 })
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
                                    "value": otp
                                },
                                "button_1": {
                                    "subtype": "url",
                                    "type": "text",
                                    "value": otp
                                }
                            }
                        }
                    ]
                }
            }
        }

        console.log('Sending to MSG91:', JSON.stringify(payload, null, 2))

        const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
            method: 'POST',
            headers: {
                'authkey': MSG91_AUTH_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()
        console.log("MSG91 Response:", JSON.stringify(data))

        if (response.ok && !data.error) {
            return NextResponse.json({ success: true, provider_response: data })
        } else {
            console.error('MSG91 API Error:', data)
            // We return 200 even on API error to avoid blocking Supabase flow if possible, 
            // but user won't get OTP. Better to return 500 so Supabase knows it failed.
            return NextResponse.json({ error: 'MSG91 Service Error', details: data }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Webhook Internal Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
