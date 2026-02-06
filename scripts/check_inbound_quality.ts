
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkInboundQuality() {
    console.log('=== Checking Last 20 INBOUND Messages ===\n');

    const { data: inbounds } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(20);

    if (!inbounds || inbounds.length === 0) {
        console.log("No inbound messages found.");
        return;
    }

    for (const m of inbounds) {
        console.log(`--------------------------------------------------`);
        console.log(`ID: ${m.id}`);
        console.log(`Time: ${new Date(m.created_at).toLocaleString()}`);
        console.log(`Mobile: ${m.mobile}`);
        console.log(`Message: "${m.message}"`);
        console.log(`Metadata Source: ${m.metadata?.source || 'NULL'}`);

        // Check if it looks like a delivery report
        const p = m.metadata || {};
        const isReport = p.status || p.message_status || p.eventName;
        if (isReport) {
            console.log(`⚠️ SUSPICIOUS: Metadata contains status/event! keys: ${Object.keys(p).join(',')}`);
            console.log(`   status: ${p.status}, eventName: ${p.eventName}, direction: ${p.direction}`);
        }

        // Check for Reply
        const { data: replies } = await supabase
            .from('whatsapp_chats')
            .select('created_at, message, metadata')
            .eq('mobile', m.mobile)
            .eq('direction', 'outbound')
            .gt('created_at', m.created_at)
            .order('created_at', { ascending: true })
            .limit(1);

        if (replies && replies.length > 0) {
            console.log(`✅ AI Replied: "${replies[0].message?.substring(0, 30)}..." [${replies[0].metadata?.source}]`);
        } else {
            console.log(`❌ NO REPLY FOUND`);
        }
    }
}

checkInboundQuality();
