
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/msg91'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
        return NextResponse.json({ error: 'Phone required' })
    }

    // Fix: Ensure 91 prefix for India
    let targetPhone = phone.replace(/\D/g, '') // Remove non-digits
    if (targetPhone.length === 10) {
        targetPhone = '91' + targetPhone
    }

    try {
        const result = await sendWhatsAppMessage({
            mobile: targetPhone,
            templateName: 'd2b_abandoned_cart',
            components: {
                body_1: { type: 'text', value: 'Kotacart' },
                button_1: { subtype: 'url', type: 'text', value: 'cart' }
            }
        })

        return NextResponse.json({
            sent_to: targetPhone,
            result: result
        })
    } catch (error) {
        return NextResponse.json({ error: error }, { status: 500 })
    }
}
