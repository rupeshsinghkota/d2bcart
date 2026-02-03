
// Run with: npx tsx scripts/test_remarketing_manual.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sendWhatsAppMessage } from '../lib/msg91';

async function runTest() {
    const mobile = "8000421913";

    // DEBUG: Show Namespace
    const ns = process.env.MSG91_NAMESPACE || "de03d239_9cbd_4348_ad12_4d8a4ea70188";
    console.log(`Using Namespace: ${ns}`);
    console.log(`Sending v1 test message to ${mobile}...`);

    // TEST: No-Variable Template Strategy
    const result = await sendWhatsAppMessage({
        mobile,
        templateName: 'd2b_daily_remarketing_simplest',
        components: {
            header: {
                type: 'document',
                document: {
                    // Using Google Research PDF as it's reliable
                    link: `https://research.google.com/pubs/archive/44678.pdf`,
                    filename: 'Covers_Collection.pdf'
                }
            }
            // NO Body params
        }
    });

    console.log("Result:", JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
