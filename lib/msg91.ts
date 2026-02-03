
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

    try {
        const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
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

// Helper: Transform simplified "body_1: value" to MSG91 V5 structure
function transformComponents(simpleComponents: any): any[] {
    const components: any[] = []

    // 1. Header
    if (simpleComponents.header) {
        const h = simpleComponents.header
        if (h.type === 'document') {
            components.push({
                type: 'header',
                parameters: [{
                    type: 'document',
                    document: {
                        link: h.document.link,
                        filename: h.document.filename
                    }
                }]
            })
        } else if (h.type === 'image') {
            components.push({
                type: 'header',
                parameters: [{
                    type: 'image',
                    image: { link: h.image.link }
                }]
            })
        }
    }

    // 2. Body (Variables)
    // Supports body_1, body_2, ... body_10 securely in order
    const bodyParams: any[] = []

    // DEBUG:
    // console.log("Transforming Components Input:", JSON.stringify(simpleComponents))

    // Explicitly check for body_1, body_2, etc. to ensure order and existence
    for (let i = 1; i <= 10; i++) {
        const key = `body_${i}`
        if (simpleComponents[key] && simpleComponents[key].type === 'text') {
            bodyParams.push({
                type: 'text',
                text: simpleComponents[key].value
            })
        }
    }

    if (bodyParams.length > 0) {
        components.push({
            type: 'body',
            parameters: bodyParams
        })
    }

    // 3. Buttons (Dynamic URL)
    // Supports button_1
    if (simpleComponents.button_1 && simpleComponents.button_1.subtype === 'url') {
        components.push({
            type: 'button',
            sub_type: 'url',
            index: '0', // First button
            parameters: [{
                type: 'text',
                text: simpleComponents.button_1.value // The variable part of the URL
            }]
        })
    }

    return components
}
