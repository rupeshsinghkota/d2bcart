import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verifyLatestOrder() {
    console.log("🔍 Checking the latest order for attribution data...");

    // Re-initialize client directly here to avoid ESM hoisting issues causing missing env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("❌ IDs missing from env");
        return;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select('id, created_at, utm_source, utm_medium, utm_campaign, gclid, fbclid, attribution_data, total_amount')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("❌ Error fetching orders:", error);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log("⚠️ No orders found.");
        return;
    }

    const order = orders[0];
    console.log("\n✅ Latest Order Found:");
    console.log(`- Order ID: ${order.id}`);
    console.log(`- Created At: ${new Date(order.created_at).toLocaleString()}`);
    console.log(`- Amount: ₹${order.total_amount}`);

    console.log("\n📊 Attribution Data:");
    if (order.utm_source || order.fbclid) {
        console.log(`- UTM Source: ${order.utm_source || 'N/A'}`);
        console.log(`- UTM Campaign: ${order.utm_campaign || 'N/A'}`);
        console.log(`- FB Click ID (fbclid): ${order.fbclid || '❌ MISSING (If this was a test, it should be here)'}`);
        console.log(`- Google Click ID (gclid): ${order.gclid || 'N/A'}`);
    } else {
        console.log("❌ No attribution data found on this order.");
    }

    console.log("\n-----------------------------------");
    if (order.fbclid === 'test_fbclid_Verification_123') {
        console.log("🎉 SUCCESS: The test attribution data was correctly saved!");
    } else {
        console.log("ℹ️ This order does not match our specific test parameters. Ensure you placed the order from the tab where we set the test data.");
    }
}

verifyLatestOrder();
