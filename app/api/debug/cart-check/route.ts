
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Admin Client to bypass RLS and find user by phone
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
        return NextResponse.json({ error: 'Phone required' })
    }

    // 1. Find User
    const { data: users, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, phone, business_name')
        .ilike('phone', `%${phone}%`) // Loose match for ease
        .limit(1)

    if (userError || !users || users.length === 0) {
        return NextResponse.json({ error: 'User not found', details: userError })
    }

    const user = users[0]

    // 2. Find Cart
    const { data: cart, error: cartError } = await supabaseAdmin
        .from('carts')
        .select(`
            id, 
            updated_at, 
            cart_items (
                quantity,
                product:products (name)
            )
        `)
        .eq('user_id', user.id)
        .single()

    return NextResponse.json({
        user,
        cart_found: !!cart,
        cart_data: cart
    })
}
