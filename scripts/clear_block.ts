
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function clearBlock() {
    const mobile = '919155149597';
    console.log(`Clearing blocks for ${mobile}...`);

    const { error } = await supabase
        .from('whatsapp_chats')
        .delete()
        .eq('mobile', mobile)
        .eq('metadata->>source', 'manual_app_outbound_webhook');

    if (error) console.error(error);
    else console.log("✅ Block cleared successfully.");
}

clearBlock();
