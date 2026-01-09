
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/msg91'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
        return NextResponse.json({ error: 'Phone required' })
    }

    try {
        const result = await sendWhatsAppMessage({
            mobile: phone,
            templateName: 'd2b_abandoned_cart',
            components: {
                body_1: { type: 'text', value: 'Kotacart' }, // Hardcoded name for test
                button_1: { subtype: 'url', type: 'text', value: 'cart' }
            }
        })

        return NextResponse.json(result)
    } catch (error) {
        return NextResponse.json({ error: error }, { status: 500 })
    }
}
