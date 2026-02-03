
// Run with: npx tsx scripts/debug_header_magic.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOBILE = "918000421913";
const TEMPLATE = "d2b_daily_remarketing_simplest";
const PDF_LINK = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

async function sendProbe(name: string, pObj: any) {
    console.log(`\n--- PROBE: ${name} ---`);
    const payload = {
        integrated_number: "917557777987",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: TEMPLATE,
                language: { code: "en", policy: "deterministic" },
                namespace: process.env.MSG91_NAMESPACE || "de03d239_9cbd_4348_ad12_4d8a4ea70188",
                to_and_components: [{
                    to: [MOBILE],
                    components: [
                        {
                            type: "header",
                            parameters: [pObj]
                        },
                        { type: "body", parameters: [] }
                    ]
                }]
            }
        }
    };

    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        method: 'POST',
        headers: { 'authkey': process.env.MSG91_AUTH_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log(`Result:`, JSON.stringify(data));
    return data.request_id;
}

async function runProbes() {
    // 1. Uppercase Type
    await sendProbe("UPPERCASE_TYPE", {
        type: "DOCUMENT",
        document: { link: PDF_LINK, filename: "catalog.pdf" }
    });

    // 2. Add sub_type
    await sendProbe("WITH_SUBTYPE", {
        type: "document",
        sub_type: "document",
        document: { link: PDF_LINK, filename: "catalog.pdf" }
    });

    // 3. Media Type (Generic)
    await sendProbe("MEDIA_TYPE", {
        type: "media",
        document: { link: PDF_LINK, filename: "catalog.pdf" }
    });
}

runProbes().catch(console.error);
