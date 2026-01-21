
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkProduct(id: string) {
    console.log(`Checking Product: ${id}`)

    // 1. Fetch Parent
    const { data: parent, error: pError } = await supabase
        .from('products')
        .select('id, name, smart_tags, ai_metadata, parent_id')
        .eq('id', id)
        .single()

    if (pError) {
        console.error('Error fetching parent:', pError)
        return
    }

    console.log('--- Parent Product ---')
    console.log('Name:', parent.name)
    console.log('AI Metadata:', JSON.stringify(parent.ai_metadata, null, 2))
    console.log('Tags:', parent.smart_tags)

    // 2. Fetch Variations
    const { data: variations, error: vError } = await supabase
        .from('products')
        .select('id, name, smart_tags, ai_metadata, parent_id')
        .eq('parent_id', id)

    if (vError) {
        console.error('Error fetching variations:', vError)
        return
    }

    console.log(`\n--- Variations (${variations?.length || 0}) ---`)
    variations?.forEach(v => {
        console.log(`ID: ${v.id}`)
        console.log(`Name: ${v.name}`)
        console.log(`Tags:`, v.smart_tags) // Added log for tags
        console.log('----------------')
    })
}

checkProduct('db58f560-d351-46df-a110-eee8d72b739c')
