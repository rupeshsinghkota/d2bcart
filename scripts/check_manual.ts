import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const mobile = '918651567003';

    // Check last 10 messages for this phone
    console.log(`\n=== Last 10 messages for ${mobile} ===\n`);

    const { data } = await supabase
        .from('whatsapp_chats')
        .select('message, direction, created_at, metadata')
        .eq('mobile', mobile)
        .order('created_at', { ascending: false })
        .limit(10);

    data?.reverse().forEach((msg, i) => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        const dir = msg.direction === 'inbound' ? '⬅️ IN ' : '➡️ OUT';
        const source = msg.metadata?.source || '';
        const isManual = source.includes('manual');
        console.log(`${time} ${dir} [${source}] ${isManual ? '🛑' : ''}`);
        console.log(`   "${msg.message?.slice(0, 60)}..."`);
    });

    // Check takeover status
    console.log('\n=== Human Takeover Status ===\n');

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: manualMsgs } = await supabase
        .from('whatsapp_chats')
        .select('message, metadata, created_at')
        .eq('mobile', mobile)
        .eq('direction', 'outbound')
        .gt('created_at', fourHoursAgo)
        .or('metadata->>source.is.null,metadata->>source.ilike.manual%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (manualMsgs && manualMsgs.length > 0) {
        const m = manualMsgs[0];
        const manualTime = new Date(m.created_at);
        const resumeTime = new Date(manualTime.getTime() + 4 * 60 * 60 * 1000);
        console.log('✅ TAKEOVER IS ACTIVE!');
        console.log(`   Manual msg: "${m.message?.slice(0, 40)}..."`);
        console.log(`   Time: ${manualTime.toLocaleTimeString()}`);
        console.log(`   AI resumes at: ${resumeTime.toLocaleTimeString()}`);
    } else {
        console.log('❌ Takeover NOT active - AI will respond');
    }
}

check();
