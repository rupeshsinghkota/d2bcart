
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkManualOutbound() {
    console.log('=== Checking for Manual Outbound Messages ===\n');

    const { data } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('metadata->>source', 'manual_app_outbound_webhook')
        .order('created_at', { ascending: false })
        .limit(10);

    if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} manual outbound detections:`);
        data.forEach(m => {
            console.log(`[${new Date(m.created_at).toLocaleTimeString()}] Mobile: ${m.mobile}`);
            console.log(`   Message: ${m.message}`);
            console.log('');
        });
    } else {
        console.log('❌ No manual outbound messages detected yet.');
        console.log('   Send a message from your WhatsApp mobile app to test.');
    }
}

checkManualOutbound();
