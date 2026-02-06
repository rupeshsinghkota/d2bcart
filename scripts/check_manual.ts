import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    // Check most recent debug logs
    console.log('\n=== Recent DEBUG logs (last 5 mins) ===\n');

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data } = await supabase
        .from('whatsapp_chats')
        .select('message, created_at, metadata')
        .eq('mobile', '000_DEBUG_RAW')
        .gt('created_at', fiveMinAgo)
        .order('created_at', { ascending: false })
        .limit(10);

    if (!data || data.length === 0) {
        console.log('No debug logs in last 5 mins');
        return;
    }

    data?.forEach((msg, i) => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const payload = msg.metadata?.payload;
        const dir = payload?.direction;
        const text = payload?.text?.slice(0, 15) || payload?.body?.slice(0, 15) || '[no text]';
        console.log(`${i + 1}. [${time}] dir:${dir} | "${text}" | mobile:${payload?.customerNumber?.slice(-4) || 'N/A'}`);
    });

    // Check for ANY manual_detected entries
    console.log('\n=== Any manual_detected entries (ever)? ===\n');
    const { data: manuals } = await supabase
        .from('whatsapp_chats')
        .select('message, created_at, metadata, mobile')
        .ilike('metadata->>source', 'manual%')
        .order('created_at', { ascending: false })
        .limit(3);

    if (manuals && manuals.length > 0) {
        console.log(`Found ${manuals.length} manual entries!`);
        manuals.forEach(m => {
            console.log(`  - [${new Date(m.created_at).toLocaleTimeString()}] ${m.mobile}: ${m.metadata?.source}`);
        });
    } else {
        console.log('No manual_detected entries found ever');
    }
}

check();
