
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealInbounds() {
    console.log('=== Checking REAL Inbound Messages (excluding debug) ===\n');

    const { data: inbounds } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('direction', 'inbound')
        .neq('mobile', '000_DEBUG_RAW') // Exclude my debug logs
        .order('created_at', { ascending: false })
        .limit(10);

    if (!inbounds || inbounds.length === 0) {
        console.log("No real inbound messages found.");
        return;
    }

    inbounds.forEach(m => {
        console.log(`[${new Date(m.created_at).toLocaleString()}] ${m.mobile}: ${m.message}`);
    });
}

checkRealInbounds();
