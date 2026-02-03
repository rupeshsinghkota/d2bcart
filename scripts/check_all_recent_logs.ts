
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentLogs() {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    console.log(`Checking ALL logs since: ${twentyMinsAgo}...`);

    const { data, error } = await supabaseAdmin
        .from('whatsapp_chats')
        .select('*')
        .gt('created_at', twentyMinsAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No recent logs found.");
        return;
    }

    console.log(`Found ${data.length} recent logs.`);

    data.forEach((log, i) => {
        console.log(`\n--- Log ${i + 1} ---`);
        console.log(`Time: ${log.created_at}`);
        console.log(`From/To: ${log.mobile}`);
        console.log(`Direction: ${log.direction}`);
        console.log(`Status: ${log.status}`);
        console.log(`Message: ${log.message}`);
        if (log.metadata?.type) console.log(`Type: ${log.metadata.type}`);
        if (log.status === 'failed') console.log(`Error:`, JSON.stringify(log.metadata, null, 2));
    });
}

checkRecentLogs().catch(console.error);
