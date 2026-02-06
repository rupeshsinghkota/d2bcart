
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugTakeover(mobile: string) {
    console.log(`Debugging Takeover for: ${mobile}`);

    // 1. Check last 5 outbound messages
    const { data: messages, error } = await supabase
        .from('whatsapp_chats')
        .select('id, message, created_at, metadata')
        .eq('mobile', mobile)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    console.log('--- Recent Outbound Messages ---');
    messages?.forEach(m => {
        const source = m.metadata?.source || 'NULL';
        const isAI = source === 'ai_assistant' || source === 'sourcing_agent';
        console.log(`[${m.created_at}] [Source: ${source}] ID: ${m.id}`);
        console.log(`   Text: "${m.message?.substring(0, 50)}..."`);
        console.log(`   Is AI? ${isAI} -> Should Pause? ${!isAI}`);
        console.log('--------------------------------');
    });

    // 2. Simulate the Query Logic
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: takeoverMsg } = await supabase
        .from('whatsapp_chats')
        .select('id, message, metadata')
        .eq('mobile', mobile)
        .eq('direction', 'outbound')
        .gt('created_at', fourHoursAgo)
        .or('metadata->>source.is.null,metadata->>source.neq.ai_assistant') // The logic used in route
        .limit(1);

    console.log('\n--- Query Simulation Result ---');
    if (takeoverMsg && takeoverMsg.length > 0) {
        console.log('✅ TAKEOVER ACTIVE. Found manual message:', takeoverMsg[0].id);
    } else {
        console.log('❌ TAKEOVER INACTIVE. No manual messages found in last 4h matching query.');
    }
}

// Check the number user mentioned might have issues with
// Note: User said "+917557777987" is the bot number, but typically 'mobile' in DB is the USER'S number.
// Wait, the user said "human takeover to +917557777987".
// If +917557777987 is the *receiver* (bot), then we need to look for chats where *sender* was the human admin?
// NO. The webhook logic is: "Did we send an OUTBOUND message to the CUSTOMER?"
// So I need to know the CUSTOMER number the user was testing with.
// I will just list the latest chats generally.

async function checkSpecificNumber() {
    const mobile = "918000421913";
    console.log(`\n--- Checking Chats for ${mobile} ---`);
    const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('id, created_at, message, direction, metadata, status')
        .eq('mobile', mobile)
        .order('created_at', { ascending: false })
        .limit(10);

    chats?.forEach(c => {
        const source = c.metadata?.source || 'NULL';
        console.log(`[${c.created_at}] ${c.direction.toUpperCase()} | Status: ${c.status} | Source: ${source}`);
        console.log(`   Message: "${c.message?.substring(0, 100)}..."`);
    });
}

(async () => {
    await checkSpecificNumber();
})();
