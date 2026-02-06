
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sendWhatsAppMessage } from '../lib/msg91';

async function main() {
    const TARGET_NUMBER = '918000421913';
    const SUPPLIER_NUMBER = '917557777998';
    const TEMPLATE_NAME = 'd2b_ai_response'; // <--- CHANGE THIS IF NEEDED

    console.log(`Sending TEMPLATE '${TEMPLATE_NAME}' to ${TARGET_NUMBER} from Supplier Line ${SUPPLIER_NUMBER}...`);

    const result = await sendWhatsAppMessage({
        mobile: TARGET_NUMBER,
        templateName: TEMPLATE_NAME,
        integratedNumber: SUPPLIER_NUMBER,
        components: {
            body_1: {
                type: 'text',
                value: "Test Message from AI Agent"
            }
        }
    });

    console.log("Result:", JSON.stringify(result, null, 2));

    if (result.error) {
        console.log("\nPOSSIBLE FIXES:");
        console.log("1. Go to MSG91 Dashboard -> WhatsApp -> Templates.");
        console.log(`2. Ensure a template named '${TEMPLATE_NAME}' exists.`);
        console.log("3. Ensure it is approved for 'English' (en).");
        console.log("4. Ensure your Supplier Number is linked to the same WABA as this template.");
    }
}

main().catch(console.error);
