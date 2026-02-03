
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkLogs() {
    const adminMobile = "919155149597";
    console.log(`Checking logs for admin: ${adminMobile}...`);

    const { data, error } = await supabaseAdmin
        .from('whatsapp_chats')
        .select('*')
        .eq('mobile', adminMobile)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No logs found for this number.");
        return;
    }

    data.forEach((log, i) => {
        console.log(`\n--- Log ${i + 1} ---`);
        console.log(`Time: ${log.created_at}`);
        console.log(`Status: ${log.status}`);
        console.log(`Message: ${log.message}`);
        console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2));
    });
}

checkLogs().catch(console.error);
