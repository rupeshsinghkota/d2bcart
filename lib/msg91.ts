
export interface Msg91Component {
    type: 'text' | 'image' | 'video' | 'document' | 'body' | 'header' | 'button'
    sub_type?: 'url' | 'quick_reply'
    parameters?: any[] // Flexible for complex templates
    value?: string
    index?: string
}

/*
    NOTE: Msg91 V5 API structure for WhatsApp is specific.
    To simplify usage, this helper focuses on the "to_and_components" structure.
*/


export async function sendWhatsAppMessage({
    mobile,
    templateName,
    components,
    namespace = process.env.MSG91_NAMESPACE || "de03d239_9cbd_4348_ad12_4d8a4ea70188",
    integratedNumber
}: {
    mobile: string,
    templateName: string,
    components: any,
    namespace?: string,
    integratedNumber?: string
}) {
    const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY
    const MSG91_INTEGRATED_NUMBER = integratedNumber || process.env.MSG91_INTEGRATED_NUMBER || "917557777987"

    if (!MSG91_AUTH_KEY) return { success: false, error: 'Configuration missing' }

    let cleanPhone = mobile.replace('+', '').replace(/\s/g, '')

    // Auto-fix for India: If 10 digits, add '91'
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone
    }

    const payload = {
        integrated_number: MSG91_INTEGRATED_NUMBER,
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: "en",
                    policy: "deterministic"
                },
                namespace: namespace,
                to_and_components: [
                    {
                        to: [cleanPhone],
                        components: transformComponents(components)
                    }
                ]
            }
        }
    }

    return await executeMsg91Call(payload, true)
}

/**
 * Sends a FREE-FORM text message (Session Message).
 * Only works if the customer has messaged you in the last 24 hours.
 */
export async function sendWhatsAppSessionMessage(params: { mobile: string, message: string }) {
    const { mobile, message } = params
    let cleanPhone = mobile.replace('+', '').replace(/\s/g, '')

    // Auto-fix for India: If 10 digits, add '91'
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone
    }

    const namespace = process.env.MSG91_NAMESPACE
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || "917557777987"

    const payload = {
        integrated_number: integratedNumber,
        recipient_number: cleanPhone,
        content_type: "text",
        text: message
    }

    return await executeMsg91Call(payload)
}

/**
 * Sends an IMAGE using a TEMPLATE (since session images aren't supported).
 * Template: d2b_product_image
 * Header: Image (Dynamic)
 * Body variable {{1}}: Caption/Text
 */
export async function sendWhatsAppImageTemplate(params: {
    mobile: string,
    imageUrl: string,
    caption: string
}) {
    const { mobile, imageUrl, caption } = params

    return await sendWhatsAppMessage({
        mobile,
        templateName: 'd2b_product_image',
        components: {
            header: {
                type: 'image',
                value: imageUrl
            },
            body_1: {
                type: 'text',
                value: caption
            }
        }
    })
}

async function executeMsg91Call(payload: any, isBulk: boolean = false) {
    const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY
    if (!MSG91_AUTH_KEY) return { success: false, error: 'MSG91_AUTH_KEY missing' }

    const endpoint = isBulk
        ? 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/'
        : 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'authkey': MSG91_AUTH_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()
        if (response.ok && !data.error) return { success: true, data }

        console.error('[MSG91] Error Response:', JSON.stringify(data))
        console.error('[MSG91] Failed Payload:', JSON.stringify(payload))

        return { success: false, error: data }
    } catch (e) {
        console.error('[MSG91] Network/System Exception:', e)
        return { success: false, error: e }
    }
}

// Helper: Transform simplified components to MSG91 "Simple Object" structure
// This matches the working OTP implementation in app/api/auth/hooks/msg91/route.ts
function transformComponents(simpleComponents: any): any {
    const components: any = {}

    // 1. Header
    if (simpleComponents.header) {
        // ... (preserving logic but potentially wrapping in the expected format if needed)
        // Actually, the OTP doesn't have a header, but if we have one:
        components.header = simpleComponents.header
    }

    // 2. Body (Variables)
    for (let i = 1; i <= 10; i++) {
        const key = `body_${i}`
        if (simpleComponents[key] && simpleComponents[key].type === 'text') {
            components[key] = {
                type: 'text',
                value: simpleComponents[key].value
            }
        }
    }

    // 3. Buttons (Dynamic URL)
    if (simpleComponents.button_1 && simpleComponents.button_1.subtype === 'url') {
        components.button_1 = {
            subtype: 'url',
            type: 'text',
            value: simpleComponents.button_1.value
        }
    }

    return components
}
