
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRawWebhooks() {
    console.log('=== RAW WEBHOOK DEBUG LOGS ===\n');

    const { data } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', '000_DEBUG_RAW')
        .order('created_at', { ascending: false })
        .limit(10);

    if (data && data.length > 0) {
        console.log(`Found ${data.length} raw webhook logs:\n`);
        data.forEach(m => {
            console.log(`[${new Date(m.created_at).toLocaleTimeString()}]`);
            console.log(`   ${m.message}`);
            console.log('');
        });
    } else {
        console.log('No raw webhook logs found yet.');
        console.log('Debug logging was just deployed. Send a message to trigger it.');
    }
}

checkRawWebhooks();
