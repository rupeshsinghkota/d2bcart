
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/msg91'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const namespace = searchParams.get('namespace')

    const template = searchParams.get('template')
    const integratedNumber = searchParams.get('integrated_number')

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
            templateName: template || 'd2b_abandoned_cart',
            components: {
                body_1: { type: 'text', value: 'Kotacart' },
                button_1: { subtype: 'url', type: 'text', value: 'cart' }
            },
            namespace: namespace || undefined,
            integratedNumber: integratedNumber || undefined
        })

        return NextResponse.json({
            sent_to: targetPhone,
            config: {
                namespace: namespace || "default",
                template: template || "d2b_abandoned_cart",
                integrated_number: integratedNumber || "default"
            },
            result: result
        })
    } catch (error) {
        return NextResponse.json({ error: error }, { status: 500 })
    }
}
