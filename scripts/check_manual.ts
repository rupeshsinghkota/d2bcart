import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    console.log('\n=== DEBUG WEBHOOK LOGS (last 20) ===\n');

    const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('message, created_at, metadata')
        .eq('mobile', '000_DEBUG_RAW')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No debug logs found');
        return;
    }

    data?.forEach((msg, i) => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const payload = msg.metadata?.payload;
        console.log(`\n=== ${i + 1}. [${time}] ===`);
        console.log('Direction:', payload?.direction);
        console.log('Status:', payload?.status || payload?.message_status);
        console.log('Mobile:', payload?.customerNumber || payload?.mobile);
        console.log('wamid:', payload?.wamid);
        console.log('uuid:', payload?.uuid || payload?.message_uuid);
        console.log('Text:', payload?.text?.slice(0, 30) || payload?.body?.slice(0, 30) || '[no text]');
    });
}

check();
