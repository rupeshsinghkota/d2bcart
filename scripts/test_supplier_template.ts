
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sendWhatsAppMessage } from '../lib/msg91';

async function main() {
    const TARGET_NUMBER = '918000421913';
    const SUPPLIER_NUMBER = '917557777998';

    console.log(`Sending TEMPLATE to ${TARGET_NUMBER} from Supplier Line ${SUPPLIER_NUMBER}...`);

    // Using d2b_ai_response as requested
    const result = await sendWhatsAppMessage({
        mobile: TARGET_NUMBER,
        templateName: 'd2b_ai_response',
        integratedNumber: SUPPLIER_NUMBER,
        components: {
            body_1: {
                type: 'text',
                value: "Hello! We are contacting you from D2BCart Sourcing Team regarding your products."
            }
        }
    });

    console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
