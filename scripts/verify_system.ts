import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create client with Service Role to bypass RLS for admin checks if needed
const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
    console.log('--- STARTING VERIFICATION ---')

    // 1. Get a test product
    const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .limit(1)

    if (!products || products.length === 0) {
        console.log('❌ No products found to test.')
        return
    }

    const testProduct = products[0]
    console.log(`✅ Found Product: ${testProduct.name} (${testProduct.id})`)

    // 2. Test Ranked Search (RPC) directly
    // We'll mimic the logic: "Maximum Combination"
    // Let's assume the product is "OnePlus Nord Cover"
    // Search query: "OnePlus Cover" should find it even if strict FTS fails (simulated)

    const terms = testProduct.name.split(' ').slice(0, 2)
    const query = terms.join(' | ') // "OnePlus | Nord"

    console.log(`\n🔍 Testing RPC 'search_products_ranked' with query: "${query}"`)

    const { data: ranked, error: rpcError } = await supabase
        .rpc('search_products_ranked', {
            search_query: query,
            limit_count: 5,
            offset_count: 0
        })

    if (rpcError) {
        console.error('❌ RPC Failed:', rpcError)
    } else {
        console.log(`✅ RPC Success! Found ${ranked.length} results.`)
        if (ranked.length > 0) {
            console.log('   Top Result:', ranked[0].name)
            if (ranked[0].id === testProduct.id) {
                console.log('   🎯 Exact Match Found!')
            }
        }
    }

    // 3. Test AI Refinement (Mock)
    // We'll manually run the logic since we aren't calling the server action file itself (it requires Next.js context)
    // But we want to confirm the DB column exists and accepts writes.

    console.log(`\n🤖 Testing AI Refinement (DB Write) for ID: ${testProduct.id}`)

    const mockTags = ['TestTag', 'AI_Generated', 'Verified']
    const mockMeta = { source: 'script_test', confidence: 0.99 }

    const { error: updateError } = await supabase
        .from('products')
        .update({
            smart_tags: mockTags,
            ai_metadata: mockMeta
        })
        .eq('id', testProduct.id)

    if (updateError) {
        console.error('❌ Update Failed:', updateError)
    } else {
        console.log('✅ Update Success! wrote smart_tags and ai_metadata.')

        // Verify read
        const { data: check } = await supabase
            .from('products')
            .select('smart_tags, ai_metadata')
            .eq('id', testProduct.id)
            .single()

        console.log('   Read Verification:', check)
    }

    console.log('--- VERIFICATION COMPLETE ---')
}

verify()
