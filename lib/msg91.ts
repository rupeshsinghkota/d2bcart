
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
    namespace = process.env.MSG91_NAMESPACE || "de03d239_9cbd_4348_ad12_4d8a4ea70188"
}: {
    mobile: string,
    templateName: string,
    components: any,
    namespace?: string
}) {
    const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY
    const MSG91_INTEGRATED_NUMBER = process.env.MSG91_INTEGRATED_NUMBER || "917557777987"

    if (!MSG91_AUTH_KEY) return { success: false, error: 'Configuration missing' }

    const cleanPhone = mobile.replace('+', '').replace(/\s/g, '')

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
                        components: components
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
        return { success: false, error: data }
    } catch (e) {
        return { success: false, error: e }
    }
}
