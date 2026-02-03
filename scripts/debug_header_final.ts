
// Run with: npx tsx scripts/debug_header_final.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOBILE = "918000421913";
const TEMPLATE = "d2b_daily_remarketing_simplest";
const PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const ALT_PDF = "https://pdfobject.com/pdf/sample.pdf";

async function sendProbe(name: string, docObject: any) {
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
                to_and_components: [
                    {
                        to: [MOBILE],
                        components: [
                            {
                                type: "header",
                                parameters: [
                                    {
                                        type: "document",
                                        document: docObject
                                    }
                                ]
                            },
                            { type: "body", parameters: [] }
                        ]
                    }
                ]
            }
        }
    };

    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        method: 'POST',
        headers: { 'authkey': process.env.MSG91_AUTH_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log(`Payload Doc:`, JSON.stringify(docObject));
    console.log(`Result:`, JSON.stringify(data));
    return data.request_id;
}

async function runProbes() {
    // 1. Add Caption
    await sendProbe("WITH_CAPTION", {
        link: PDF_URL,
        filename: "catalog.pdf",
        caption: "Catalog"
    });

    // 2. Use 'url' instead of 'link'
    await sendProbe("USE_URL_KEY", {
        url: PDF_URL,
        filename: "catalog.pdf"
    });

    // 3. Different PDF Source
    await sendProbe("ALT_PDF_SOURCE", {
        link: ALT_PDF,
        filename: "sample.pdf"
    });
}

runProbes().catch(console.error);
