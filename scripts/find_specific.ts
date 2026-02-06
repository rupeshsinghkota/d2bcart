
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findSpecificLog() {
    console.log('=== FINDING SPECIFIC LOG FOR 916360822830 ===');

    const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', '916360822830')
        .order('created_at', { ascending: false })
        .limit(5);

    chats?.forEach(c => {
        console.log(`\nID: ${c.id}`);
        console.log(`Created At: ${c.created_at} (UTC)`);
        console.log(`Local Time: ${new Date(c.created_at).toLocaleString()}`);
        console.log(`Message: ${c.message}`);
        console.log(`Source: ${c.metadata?.source}`);
    });
}

findSpecificLog();
