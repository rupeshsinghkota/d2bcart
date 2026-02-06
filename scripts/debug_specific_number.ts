
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNumber() {
    const mobile = '918651567003';
    console.log(`\n=== Full Audit for ${mobile} ===\n`);

    // Check ALL chats
    const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', mobile)
        .order('created_at', { ascending: false })
        .limit(20);

    console.log(`--- Complete Chat History ---`);
    if (chats && chats.length) {
        chats.forEach(c => {
            const time = new Date(c.created_at).toLocaleTimeString();
            const src = c.metadata?.source || 'NULL';
            console.log(`[${time}] ${c.direction.toUpperCase()} | Source: ${src}`);
            console.log(`   MSG: ${c.message?.substring(0, 100)}`);
        });
    } else {
        console.log("No chats found.");
    }

    // Check takeover status
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: takeover } = await supabase
        .from('whatsapp_chats')
        .select('id, message, metadata, created_at')
        .eq('mobile', mobile)
        .eq('direction', 'outbound')
        .gt('created_at', fourHoursAgo)
        .or('metadata->>source.is.null,metadata->>source.neq.ai_assistant');

    console.log(`\n--- Takeover Check ---`);
    if (takeover && takeover.length) {
        console.log(`⚠️ TAKEOVER ACTIVE! ${takeover.length} blocking message(s):`);
        takeover.forEach(t => {
            console.log(`   [${new Date(t.created_at).toLocaleTimeString()}] "${t.message?.substring(0, 40)}..." | Source: ${t.metadata?.source || 'NULL'}`);
        });
    } else {
        console.log("✅ No takeover active - AI should be responding.");
    }
}

checkNumber();
