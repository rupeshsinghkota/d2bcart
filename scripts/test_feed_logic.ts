
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyFeedSync() {
    console.log("=== FEED SYNC VERIFICATION ===\n");

    const deactivatedId = "343aef96-17e3-4ab3-a2c8-d469a91eed57"; // Tom & Jerry Case (Deactivated)

    // 1. Find a product from an unverified manufacturer
    const { data: unverifiedProduct } = await supabase
        .from('products')
        .select('id, name, manufacturer:manufacturer_id!inner(business_name, is_verified)')
        .eq('is_active', true)
        .eq('manufacturer.is_verified', false)
        .limit(1)
        .maybeSingle();

    console.log("Test Case 1: Deactivated Product Check");
    console.log(`Checking ID: ${deactivatedId}`);

    // Query mimicking the NEW feed logic
    const { data: feedResults } = await supabase
        .from('products')
        .select('id, name, manufacturer:manufacturer_id!inner(is_verified)')
        .eq('is_active', true)
        .eq('manufacturer.is_verified', true)
        .gt('stock', 0);

    const isDeactivatedFound = feedResults?.some(p => p.id === deactivatedId);
    if (isDeactivatedFound) {
        console.error("❌ FAILURE: Deactivated product still found in feed query!");
    } else {
        console.log("✅ SUCCESS: Deactivated product correctly excluded.");
    }

    console.log("\nTest Case 2: Unverified Manufacturer Check");
    if (unverifiedProduct) {
        console.log(`Checking Product: "${unverifiedProduct.name}" from "${unverifiedProduct.manufacturer.business_name}" (Verified: ${unverifiedProduct.manufacturer.is_verified})`);
        const isUnverifiedFound = feedResults?.some(p => p.id === unverifiedProduct.id);
        if (isUnverifiedFound) {
            console.error("❌ FAILURE: Product from unverified manufacturer still found in feed!");
        } else {
            console.log("✅ SUCCESS: Unverified manufacturer's product correctly excluded.");
        }
    } else {
        console.log("Skipping Case 2: No active products from unverified manufacturers found (Good!).");
    }

    console.log(`\nFinal Feed Size: ${feedResults?.length || 0} products.`);
}

verifyFeedSync().catch(console.error);
