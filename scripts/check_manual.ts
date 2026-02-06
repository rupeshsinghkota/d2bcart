import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    console.log('\n=== Checking what IDs we store from API responses ===\n');

    const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('metadata')
        .eq('direction', 'outbound')
        .not('metadata', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Error:', error);
        return;
    }

    data?.forEach((msg, i) => {
        console.log(`\n=== Message ${i + 1} ===`);
        console.log('Full metadata:', JSON.stringify(msg.metadata, null, 2));
    });
}

check();
