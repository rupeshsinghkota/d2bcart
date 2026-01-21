import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service key for admin access if available, else anon
// Actually, let's just use the client env vars for now if service key isn't handy, but we might need admin for some things. 
// checking environment variables... 
// I'll assume standard setup.

const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function main() {
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name')
        .limit(5)

    if (error) {
        console.error('Error fetching products:', error)
        return
    }

    console.log('Found products:', products)
}

main()
