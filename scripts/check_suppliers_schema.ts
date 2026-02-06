import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching supplier:", error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log("Existing columns:", Object.keys(data[0]));
    } else {
        console.log("Table is empty. Cannot determine columns via select *.");
    }
}

checkSchema();
