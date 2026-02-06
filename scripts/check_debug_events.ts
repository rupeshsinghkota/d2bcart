
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDebugLogs() {
    console.log(`Checking Debug Logs for hidden events...`);

    // Get last 10 events
    const { data: events, error } = await supabase
        .from('debug_webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    if (!events || events.length === 0) {
        console.log("No events found. The webhook received NOTHING.");
        return;
    }

    console.log(`Found ${events.length} recent events.`);
    events.forEach((e, i) => {
        console.log(`\n--- Event ${i + 1} [${e.created_at}] ---`);
        console.log(JSON.stringify(e.payload, null, 2));
    });
}

checkDebugLogs();
