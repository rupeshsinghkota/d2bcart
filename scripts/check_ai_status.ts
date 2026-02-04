
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatus(mobile: string) {
    console.log(`=== AI STATUS CHECK for ${mobile} ===\n`);

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // 1. Check for lockout
    const { data: recentHumanOutbound, error } = await supabase
        .from('whatsapp_chats')
        .select('id, message, created_at, metadata')
        .eq('mobile', mobile)
        .eq('direction', 'outbound')
        .gt('created_at', twoHoursAgo)
        .not('metadata->>source', 'eq', 'ai_assistant');

    if (error) {
        console.error("Error checking status:", error);
        return;
    }

    if (recentHumanOutbound && recentHumanOutbound.length > 0) {
        console.log(`🚨 LOCKOUT ACTIVE: Found ${recentHumanOutbound.length} human outbound messages in the last 2 hours.`);
        recentHumanOutbound.forEach(m => {
            console.log(` - [${new Date(m.created_at).toLocaleTimeString()}] "${m.message}"`);
        });
        console.log("\nIf you want to clear this lockout to test AI again, run this script with --clear");
    } else {
        console.log("✅ AI IS ACTIVE: No human messages found in the last 2 hours. AI should reply.");
    }

    if (process.argv.includes('--clear')) {
        console.log("\nClearing lockout for testing...");
        // Instead of deleting, we'll just update them to be 'ai' filtered for the query
        const { error: updateErr } = await supabase
            .from('whatsapp_chats')
            .update({ metadata: { source: 'ai_assistant', note: 'auto-cleared for testing' } })
            .eq('mobile', mobile)
            .eq('direction', 'outbound')
            .gt('created_at', twoHoursAgo);

        if (updateErr) {
            console.error("Failed to clear lockout:", updateErr);
        } else {
            console.log("✨ Lockout cleared! AI will reply to the next message.");
        }
    }
}

const phone = process.argv[2] || "918000421913";
checkStatus(phone).catch(console.error);
