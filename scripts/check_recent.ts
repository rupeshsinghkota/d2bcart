
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecent() {
    console.log('=== Last 10 Messages (All Types) ===\n');

    const { data } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    data?.forEach(m => {
        const time = new Date(m.created_at).toLocaleTimeString();
        const src = m.metadata?.source || 'NULL';
        console.log(`[${time}] ${m.direction.toUpperCase()} | Mobile: ${m.mobile}`);
        console.log(`   Msg: ${m.message?.substring(0, 50)}`);
        console.log(`   Source: ${src}`);
        console.log('');
    });
}

checkRecent();
