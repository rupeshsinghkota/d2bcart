
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deepSearch() {
    const mobile = '916360822830';
    console.log(`=== DEEP SEARCH FOR ${mobile} ===\n`);

    // Search in whatsapp_chats (message content)
    const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .ilike('message', `%${mobile}%`)
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`--- Matches in Message Text (e.g. Raw Logs) ---`);
    if (chats && chats.length) {
        chats.forEach(c => {
            console.log(`[${new Date(c.created_at).toLocaleString()}] ${c.direction} | ${c.mobile}`);
            console.log(`   ${c.message.substring(0, 100)}...`);
        });
    } else {
        console.log("No matches found.");
    }
}

deepSearch();
