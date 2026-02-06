import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    console.log('\n=== DEBUG LOGS - Last 10 (checking direction:1 events) ===\n');

    const { data } = await supabase
        .from('whatsapp_chats')
        .select('message, created_at, metadata')
        .eq('mobile', '000_DEBUG_RAW')
        .order('created_at', { ascending: false })
        .limit(10);

    data?.forEach((msg, i) => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const payload = msg.metadata?.payload;
        const dir = payload?.direction;
        console.log(`${i + 1}. [${time}] dir:${dir} | text:"${payload?.text?.slice(0, 20) || '[no text]'}" | mobile:${payload?.customerNumber || payload?.mobile}`);
    });

    // Now check - when we get direction:1, is there a recent API message?
    console.log('\n=== Testing: Recent API messages in last 30s ===\n');

    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: recentApi } = await supabase
        .from('whatsapp_chats')
        .select('message, created_at, metadata')
        .eq('mobile', '918651567003')
        .eq('direction', 'outbound')
        .gt('created_at', thirtySecondsAgo)
        .not('metadata->>source', 'ilike', 'manual%')
        .limit(5);

    if (recentApi && recentApi.length > 0) {
        console.log(`Found ${recentApi.length} API messages in last 30s:`);
        recentApi.forEach(m => {
            console.log(`  - [${new Date(m.created_at).toLocaleTimeString()}] ${m.metadata?.source}: "${m.message?.slice(0, 30)}..."`);
        });
    } else {
        console.log('No API messages in last 30s - manual detection SHOULD trigger');
    }
}

check();
