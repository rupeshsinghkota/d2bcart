
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '../lib/msg91';

// Initialize Supabase Admin
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

async function runBatchRemarketing() {
    console.log("Starting Batch Remarketing Run...");

    const twentyFourHoursAgoForBrowse = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Get recent interactions (FETCH 1)
    const { data: interactions, error } = await supabaseAdmin
        .from('user_interactions')
        .select(`user_id, product_id, interaction_type, created_at`)
        .gt('created_at', twentyFourHoursAgoForBrowse)
        .not('user_id', 'is', null);

    if (error) {
        console.error("Error fetching interactions:", error);
        return;
    }

    if (!interactions || interactions.length === 0) {
        console.log("No recent interactions found.");
        return;
    }

    console.log(`Found ${interactions.length} interactions. Fetching details...`);

    // Collect IDs
    const userIds = [...new Set(interactions.map(i => i.user_id))];
    const productIds = [...new Set(interactions.map(i => i.product_id))];

    // FETCH 2: Users
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, phone, business_name')
        .in('id', userIds);

    const userMap = (users || []).reduce((acc: any, u: any) => {
        acc[u.id] = u;
        return acc;
    }, {});

    // FETCH 3: Products -> Categories
    const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, category_id, name')
        .in('id', productIds);

    const productMap = (products || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
    }, {});

    console.log(`Loaded ${users?.length || 0} users and ${products?.length || 0} products.`);

    // Group by User -> Category
    const userCategoryCounts: Record<string, Record<string, number>> = {};
    const userDetails: Record<string, { phone: string, name: string }> = {};

    for (const interaction of interactions) {
        const userId = interaction.user_id;
        const productId = interaction.product_id;

        const user = userMap[userId];
        const product = productMap[productId];

        if (!user || !product || !product.category_id || !user.phone) continue;

        if (!userCategoryCounts[userId]) {
            userCategoryCounts[userId] = {};
            userDetails[userId] = {
                phone: user.phone,
                name: user.business_name || 'Partner'
            };
        }

        if (!userCategoryCounts[userId][product.category_id]) {
            userCategoryCounts[userId][product.category_id] = 0;
        }

        userCategoryCounts[userId][product.category_id]++;
    }

    // Process each user
    for (const userId in userCategoryCounts) {
        // Find winning category
        let topCategoryId = '';
        let maxCount = 0;
        for (const catId in userCategoryCounts[userId]) {
            if (userCategoryCounts[userId][catId] > maxCount) {
                maxCount = userCategoryCounts[userId][catId];
                topCategoryId = catId;
            }
        }

        if (topCategoryId) {
            // Check recently sent
            let recentSent = 0;
            try {
                const { count } = await supabaseAdmin
                    .from('catalog_downloads')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gt('created_at', new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString());
                recentSent = count || 0;
            } catch (err) {
                console.error('[Remarketing] Recent check failed:', err);
            }

            if ((recentSent || 0) === 0) {
                // Check recent orders
                let recentOrders = 0;
                try {
                    const { count } = await supabaseAdmin
                        .from('orders')
                        .select('id', { count: 'exact', head: true })
                        .eq('retailer_id', userId)
                        .gt('created_at', twentyFourHoursAgoForBrowse);
                    recentOrders = count || 0;
                } catch (e) { }

                if ((recentOrders || 0) === 0) {
                    try {
                        // Fetch Category Name AND Slug
                        const { data: catData } = await supabaseAdmin
                            .from('categories')
                            .select('name, slug')
                            .eq('id', topCategoryId)
                            .single();

                        const categoryName = catData?.name || 'Popular';
                        const categorySlug = catData?.slug || '';

                        console.log(`[Remarketing] Sending to User: ${userId} (${userDetails[userId].phone}), Category: ${categoryName}`);

                        const result = await sendWhatsAppMessage({
                            mobile: userDetails[userId].phone,
                            templateName: 'd2b_daily_text_v1',
                            components: {
                                body_1: { type: 'text', value: userDetails[userId].name },
                                body_2: { type: 'text', value: categoryName },
                                body_3: { type: 'text', value: `https://d2bcart.com/products?category=${categorySlug}` }
                            }
                        });
                        console.log("Send Result:", JSON.stringify(result));

                        // Log it
                        const { error: insertError } = await supabaseAdmin.from('catalog_downloads').insert({
                            user_id: userId,
                            category_id: topCategoryId,
                            source_page: 'manual_batch_run'
                        });
                        if (insertError) console.error('[Remarketing] DB Insert Error:', insertError);

                    } catch (e: any) {
                        console.error('[Remarketing] Exception:', e.message || e);
                    }
                } else {
                    console.log(`Skipping User ${userId}: Placed order recently.`);
                }
            } else {
                console.log(`Skipping User ${userId}: Already sent recently.`);
            }
        }
    }
    console.log("Batch Run Complete.");
}

runBatchRemarketing().catch(console.error);
