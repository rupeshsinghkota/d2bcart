
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findTheEvent() {
    console.log('=== SEARCHING FOR 5:39 PM EVENT (Last 24h) ===\n');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: events } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('metadata->>source', 'manual_app_outbound_webhook')
        .gt('created_at', yesterday)
        .order('created_at', { ascending: false });

    if (!events || events.length === 0) {
        console.log("No manual outbound events found in last 24h.");
        return;
    }

    events.forEach(e => {
        // Log both UTC and Local
        const date = new Date(e.created_at);
        console.log(`ID: ${e.id}`);
        console.log(`UTC: ${date.toISOString()}`);
        console.log(`Local: ${date.toLocaleString()}`);
        console.log(`Mobile: ${e.mobile}`);
        console.log(`Raw Payload:`);
        console.log(JSON.stringify(e.metadata?.raw, null, 2));
        console.log('-------------------------------------------');
    });
}

findTheEvent();
