import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedSuppliers() {
    const suppliers = [
        {
            name: "THE COLLECTION (MOBILE ACCESSORIES WHOLESALE)",
            phone: "919429690550",
            location: "Delhi (Karol Bagh)",
            status: "discovered"
        },
        {
            name: "Great Choice (Mobile Accessories & Spare Parts)",
            phone: "919319643999",
            location: "Delhi (Gaffar Market)",
            status: "discovered"
        },
        {
            name: "ELICER MOBILE ACCESSORIES",
            phone: "919990554447",
            location: "Delhi",
            status: "discovered"
        }
    ];

    console.log("Seeding discovered suppliers...");

    for (const s of suppliers) {
        // Use normal insert
        const { error } = await supabase
            .from('suppliers')
            .insert(s);

        if (error) {
            // Postgres error code for unique constraint violation is 23505
            if (error.code === '23505') {
                console.log(`⏩ ${s.name} already exists.`);
            } else {
                console.error(`Error seeding ${s.name}:`, error.message);
            }
        } else {
            console.log(`✅ Seeded ${s.name}`);
        }
    }
}

seedSuppliers();
