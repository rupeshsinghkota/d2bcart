import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    console.log('\n=== Checking debug logs for 998 routing issues ===\n');

    // Check recent debug logs with receiver info
    const { data: debugLogs } = await supabase
        .from('whatsapp_chats')
        .select('message, created_at, metadata')
        .eq('mobile', '000_DEBUG_RAW')
        .order('created_at', { ascending: false })
        .limit(15);

    console.log('=== Raw Webhook DEBUG logs (last 15) ===\n');
    debugLogs?.forEach((msg, i) => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const payload = msg.metadata?.payload;
        const receiver = payload?.integratedNumber || payload?.receiver || payload?.integrated_number || 'N/A';
        const mobile = payload?.customerNumber?.slice(-4) || payload?.mobile?.slice(-4) || 'N/A';
        const text = payload?.text?.slice(0, 15) || payload?.content?.slice(0, 15) || '[no text]';
        console.log(`${i + 1}. [${time}] receiver:${receiver} | mobile:...${mobile} | "${text}"`);
    });

    // Check for any sourcing_agent responses in last hour
    console.log('\n=== Sourcing Agent Responses (last 1 hour) ===\n');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: agentMsgs } = await supabase
        .from('whatsapp_chats')
        .select('mobile, message, created_at')
        .eq('direction', 'outbound')
        .ilike('metadata->>source', 'sourcing_agent')
        .gt('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(5);

    if (agentMsgs && agentMsgs.length > 0) {
        agentMsgs.forEach(msg => {
            const time = new Date(msg.created_at).toLocaleTimeString();
            console.log(`[${time}] To: ${msg.mobile}: "${msg.message?.slice(0, 50)}..."`);
        });
    } else {
        console.log('❌ No Sourcing Agent responses in last hour');
    }

    // Check supplier 918651567003
    console.log('\n=== Last messages for 918651567003 on 998 line ===\n');
    const { data: supplierMsgs } = await supabase
        .from('whatsapp_chats')
        .select('message, direction, created_at, metadata')
        .eq('mobile', '918651567003')
        .order('created_at', { ascending: false })
        .limit(10);

    supplierMsgs?.forEach(msg => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const dir = msg.direction === 'inbound' ? '⬅️ IN ' : '➡️ OUT';
        const source = msg.metadata?.source || '';
        console.log(`${time} ${dir} [${source}] "${msg.message?.slice(0, 40)}..."`);
    });
}

check();
