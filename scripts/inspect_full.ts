
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectFullPayload() {
    console.log('=== INSPECTING FULL PAYLOAD ===\n');

    const { data } = await supabase
        .from('whatsapp_chats')
        .select('created_at, metadata')
        .eq('mobile', '000_DEBUG_RAW')
        .order('created_at', { ascending: false })
        .limit(3);

    data?.forEach((m, i) => {
        console.log(`\n--- Message ${i + 1} [${new Date(m.created_at).toLocaleTimeString()}] ---`);
        const p = m.metadata?.payload;
        if (p) {
            console.log(JSON.stringify(p, null, 2));
        } else {
            console.log('No payload found in metadata');
        }
    });
}

inspectFullPayload();
