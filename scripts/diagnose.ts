
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
    console.log(`\n=== SYSTEM DIAGNOSIS ===\n`);

    // 1. Check if whatsapp_chats has recent data (proves webhook is working)
    const { data: recentChats, count: chatCount } = await supabase
        .from('whatsapp_chats')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5);

    console.log(`1. whatsapp_chats table: ${chatCount} total rows`);
    console.log(`   Last 5 messages:`);
    recentChats?.forEach(c => {
        console.log(`   [${new Date(c.created_at).toLocaleTimeString()}] ${c.direction} - ${c.message?.substring(0, 30)}...`);
    });

    // 2. Check if debug_webhook_events has data
    const { data: debugEvents, count: debugCount } = await supabase
        .from('debug_webhook_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5);

    console.log(`\n2. debug_webhook_events table: ${debugCount} total rows`);
    if (debugEvents && debugEvents.length > 0) {
        console.log(`   Last 5 events:`);
        debugEvents.forEach(e => {
            const p = e.payload;
            console.log(`   [${new Date(e.created_at).toLocaleTimeString()}] status=${p.status}, direction=${p.direction}, message_uuid=${p.message_uuid}`);
        });
    } else {
        console.log(`   ⚠️ Table is EMPTY or not accessible.`);
    }

    // 3. Look for ANY outbound message in whatsapp_chats that doesn't have ai_assistant or sourcing_agent source
    const { data: manualMsgs } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('direction', 'outbound')
        .or('metadata->>source.is.null,metadata->>source.eq.manual_app_outbound_webhook')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log(`\n3. Manual/Unknown outbound messages (last 5):`);
    if (manualMsgs && manualMsgs.length > 0) {
        manualMsgs.forEach(m => {
            console.log(`   [${new Date(m.created_at).toLocaleTimeString()}] ${m.mobile} - ${m.message?.substring(0, 30)}... | Source: ${m.metadata?.source || 'NULL'}`);
        });
    } else {
        console.log(`   None found. MSG91 is NOT sending outbound webhooks to your server.`);
    }
}

diagnose();
