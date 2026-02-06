
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNumber() {
    const mobile = '919155149597';
    console.log(`Checking logs for ${mobile}...`);

    // 1. Check Main Chat Table
    const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', mobile)
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`\n--- Main Chats ---`);
    if (chats && chats.length) {
        chats.forEach(c => {
            console.log(`[${new Date(c.created_at).toLocaleTimeString()}] ${c.direction} (${c.status})`);
            console.log(`   MSG: ${c.message}`);
            console.log(`   SRC: ${c.metadata?.source || '?'}`);
        });
    } else {
        console.log("No chats found.");
    }

    // 2. Check Debug Webhooks (Did we receive raw data?)
    const { data: events } = await supabase
        .from('debug_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    console.log(`\n--- Recent Webhooks (Last 20) ---`);
    let found = false;
    events?.forEach(e => {
        const payloadStr = JSON.stringify(e.payload);
        if (payloadStr.includes(mobile)) {
            found = true;
            const p = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
            console.log(`[${new Date(e.created_at).toLocaleTimeString()}] Found Payload!`);
            console.log(`   Status: ${p.status || p.message_status}`);
            console.log(`   Direction: ${p.direction}`);
            console.log(`   UUID: ${p.message_uuid}`);
        }
    });
    if (!found) console.log("No raw webhook events found for this number.");
}

checkNumber();
