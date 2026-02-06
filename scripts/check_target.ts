
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSpecificTarget() {
    const mobile = '916360822830';
    console.log(`=== CHECKING TARGET: ${mobile} ===\n`);

    // 1. Check Chat History
    console.log(`--- Chat History (Last 15) ---`);
    const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', mobile)
        .order('created_at', { ascending: false })
        .limit(15);

    if (chats && chats.length) {
        chats.forEach(c => {
            const time = new Date(c.created_at).toLocaleTimeString();
            console.log(`[${time}] ${c.direction.toUpperCase()}`);
            console.log(`   Msg: ${c.message}`);
            console.log(`   Source: ${c.metadata?.source || 'NULL'}`);
        });
    } else {
        console.log("No chats found.");
    }

    // 2. Check Raw Webhooks (Fallbacks)
    console.log(`\n--- Raw Webhook Fallbacks (Last 5 mins) ---`);
    const { data: raws } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', '000_DEBUG_RAW')
        .textSearch('message', mobile) // Search for mobile inside the raw dump
        .order('created_at', { ascending: false })
        .limit(5);

    if (raws && raws.length) {
        raws.forEach(r => {
            console.log(`[${new Date(r.created_at).toLocaleTimeString()}] Raw Log Found!`);
            console.log(`   ${r.message}`);
        });
    } else {
        console.log("No raw logs match this number.");
    }
}

checkSpecificTarget();
