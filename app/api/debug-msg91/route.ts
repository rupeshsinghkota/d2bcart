import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
        return NextResponse.json({ error: 'Please provide phone number. Example: ?phone=919876543210' })
    }

    // 1. Check Env Vars
    const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY
    const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || "917557777987"
    const MSG91_NAMESPACE = process.env.MSG91_NAMESPACE || "de03d239_9cbd_4348_ad12_4d8a4ea70188"
    const MSG91_TEMPLATE_NAME = process.env.MSG91_TEMPLATE_NAME || "d2b_login_otp"

    const config = {
        MSG91_AUTH_KEY: MSG91_AUTH_KEY ? 'Set (Hidden)' : 'MISSING ❌',
        MSG91_INTEGRATED_NUMBER,
        MSG91_NAMESPACE,
        MSG91_TEMPLATE_NAME
    }

    if (!MSG91_AUTH_KEY) {
        return NextResponse.json({ error: 'Configs missing', config })
    }

    // 2. Prepare Payload
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
                                "value": "123456" // Dummy OTP
                            }
                        }
                    }
                ]
            }
        }
    }

    // 3. Call MSG91
    try {
        const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
            method: 'POST',
            headers: {
                'authkey': MSG91_AUTH_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await res.json()

        return NextResponse.json({
            status: 'Called MSG91',
            config,
            payload_sent: payload,
            api_response: data
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message })
    }
}
