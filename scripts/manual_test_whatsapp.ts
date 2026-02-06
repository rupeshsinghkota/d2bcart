
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load env vars

import { sendWhatsAppSessionMessage } from '../lib/msg91';

async function main() {
    const TARGET_NUMBER = '918000421913';
    const SUPPLIER_NUMBER = '917557777998'; // The new integrated number

    console.log(`Sending test message to ${TARGET_NUMBER} from Supplier Line ${SUPPLIER_NUMBER}...`);

    const result = await sendWhatsAppSessionMessage({
        mobile: TARGET_NUMBER,
        message: "Hello, this is a test message from the D2BCart Sourcing Agent. Are you receiving this?",
        integratedNumber: SUPPLIER_NUMBER
    });

    console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
