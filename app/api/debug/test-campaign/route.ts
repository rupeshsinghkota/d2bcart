import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/msg91'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone') || '8000421913' // Default to user's number
    const template = searchParams.get('template') || 'd2b_7_days_reminder'
    const variable = searchParams.get('variable') || 'mobiles' // The Category ID or Filename

    try {
        let components: any = {
            body_1: { type: 'text', value: 'TestUser' }
        }

        // Add button variable if it's one of the dynamic templates
        if (template === 'd2b_7_days_reminder' || template === 'd2b_catalog_followup') {
            components.button_1 = { subtype: 'url', type: 'text', value: variable }
        }

        const result = await sendWhatsAppMessage({
            mobile: phone,
            templateName: template,
            components: components
        })

        return NextResponse.json({
            status: 'Test Sent',
            config: { phone, template, variable },
            result
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
