import { NextResponse } from 'next/server'

// This route allows Supabase to send OTPs via MSG91 (WhatsApp)
// Configure this URL in Supabase -> Authentication -> Providers -> Phone -> SMS Provider: Custom
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { user, otp } = body

        if (!user || !user.phone || !otp) {
            return new NextResponse('Missing required fields', { status: 400 })
        }

        const phone = user.phone.replace('+', '') // MSG91 usually expects number without +
        const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY
        const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID // WhatsApp Template ID/Slug
        const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER // Your WhatsApp Number integrated in MSG91

        if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
            console.error('MSG91 Credentials missing in env')
            // Return 200 to Supabase so it doesn't retry infinitely or block the UI, 
            // but log the error on server.
            return new NextResponse('MSG91 Config Missing', { status: 500 })
        }

        // MSG91 API Call (Example for Integrated Flow or WhatsApp API)
        // Adjust headers and body based on exact MSG91 documentation for your specific flow
        const response = await fetch('https://control.msg91.com/api/v5/flow/', {
            method: 'POST',
            headers: {
                'authkey': MSG91_AUTH_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                template_id: MSG91_TEMPLATE_ID,
                short_url: "0",
                recipients: [
                    {
                        mobiles: phone,
                        otp: otp
                    }
                ]
            })
        })

        const data = await response.json()

        if (data.type === 'error') {
            console.error('MSG91 Error:', data)
            return new NextResponse(JSON.stringify(data), { status: 500 })
        }

        return new NextResponse(JSON.stringify({ success: true }), { status: 200 })

    } catch (error) {
        console.error('Webhook Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
