import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    console.log('\n=== Messages between 987 and 998 ===\n');

    // Check for messages where mobile is 998 or 987
    const { data } = await supabase
        .from('whatsapp_chats')
        .select('mobile, message, direction, created_at, metadata')
        .or('mobile.eq.917557777998,mobile.eq.917557777987')
        .order('created_at', { ascending: false })
        .limit(20);

    console.log(`Found ${data?.length || 0} messages:\n`);

    data?.reverse().forEach(msg => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const dir = msg.direction === 'inbound' ? '⬅️ IN ' : '➡️ OUT';
        const source = msg.metadata?.source || '';
        const intLine = msg.metadata?.integratedNumber || '';
        console.log(`${time} | Mobile: ${msg.mobile} | ${dir} | Source: ${source} | Line: ${intLine}`);
        console.log(`   "${msg.message?.slice(0, 50)}..."\n`);
    });

    // Also check debug logs for these numbers
    console.log('\n=== Debug logs for 987/998 cross-communication ===\n');

    const { data: debugLogs } = await supabase
        .from('whatsapp_chats')
        .select('created_at, metadata')
        .eq('mobile', '000_DEBUG_RAW')
        .order('created_at', { ascending: false })
        .limit(20);

    debugLogs?.filter(log => {
        const payload = log.metadata?.payload;
        const mobile = payload?.customerNumber || payload?.mobile || '';
        return mobile.includes('987') || mobile.includes('998');
    }).forEach(log => {
        const time = new Date(log.created_at).toLocaleTimeString();
        const payload = log.metadata?.payload;
        const receiver = payload?.integratedNumber || payload?.receiver || 'N/A';
        const mobile = payload?.customerNumber || payload?.mobile || 'N/A';
        const dir = payload?.direction;
        const text = payload?.text?.slice(0, 20) || '[no text]';
        console.log(`[${time}] receiver:${receiver} | from:${mobile} | dir:${dir} | "${text}"`);
    });
}

check();
