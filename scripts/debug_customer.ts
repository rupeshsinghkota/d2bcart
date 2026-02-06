
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectCustomer() {
    const mobile = '919155149597';
    console.log(`\n--- Active Chats for ${mobile} ---`);

    // Check Chat Table
    const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', mobile)
        .order('created_at', { ascending: false })
        .limit(10);

    chats?.forEach(c => {
        console.log(`[${new Date(c.created_at).toLocaleTimeString()}] ${c.direction.toUpperCase()} | Status: ${c.status}`);
        console.log(`   Msg: ${c.message}`);
        console.log(`   Meta: ${JSON.stringify(c.metadata)}`);
    });

    console.log(`\n--- Debug Webhooks (Raw) ---`);
    // Check Debug Table (Since we log raw payload there)
    const { data: events } = await supabase
        .from('debug_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    events?.forEach(e => {
        const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
        // Simple check if this payload relates to our number
        const pStr = JSON.stringify(payload);
        if (pStr.includes(mobile)) {
            console.log(`[${new Date(e.created_at).toLocaleTimeString()}] WEBHOOK PAYLOAD:`);
            console.log(JSON.stringify(payload, null, 2).substring(0, 500) + "...");
        }
    });
}

inspectCustomer();
