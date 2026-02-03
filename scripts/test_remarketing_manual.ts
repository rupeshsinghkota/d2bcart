
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

    // TEST: Text-Only Remarketing
    const result = await sendWhatsAppMessage({
        mobile,
        templateName: 'd2b_daily_text_v1',
        components: {
            body_1: { type: 'text', value: 'Rupesh' },       // {{1}} Name
            body_2: { type: 'text', value: 'Sarees' },       // {{2}} Category
            body_3: { type: 'text', value: 'https://d2bcart.com/products?category=123' } // {{3}} Link
        }
    });

    console.log("Result:", JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
