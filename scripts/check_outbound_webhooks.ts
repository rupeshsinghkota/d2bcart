
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllWebhooks() {
    console.log(`=== Checking debug_webhook_events table ===\n`);

    // Count total
    const { count } = await supabase
        .from('debug_webhook_events')
        .select('*', { count: 'exact', head: true });

    console.log(`Total rows in table: ${count}`);

    // Get recent 5
    const { data: events } = await supabase
        .from('debug_webhook_events')
        .select('created_at, payload')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log(`\nLast 5 events:`);
    events?.forEach(e => {
        const time = new Date(e.created_at).toLocaleTimeString();
        const p = e.payload;
        console.log(`[${time}] Keys: ${Object.keys(p).join(', ')}`);
        console.log(`   Status: ${p.status}, Direction: ${p.direction}, message_uuid: ${p.message_uuid}`);
    });
}

checkAllWebhooks();
