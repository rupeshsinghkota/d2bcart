import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )

    // 1. Authenticate
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
        return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
    }

    try {
        const { items } = await request.json() // Expecting: [{ product: { id }, quantity: number }]

        // 2. Get or Create Cart for User
        const { data: cart, error: cartError } = await supabase
            .from('carts')
            .upsert(
                { user_id: session.user.id, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            )
            .select('id')
            .single()

        if (cartError) throw cartError

        // 3. Sync Items (Clear and Re-insert strategy for simplicity and consistency)
        // First, clear existing items
        const { error: deleteError } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id)

        if (deleteError) throw deleteError

        // Filter valid items and format for DB
        const dbItems = items
            .filter((item: any) => item.product?.id && item.quantity > 0)
            .map((item: any) => ({
                cart_id: cart.id,
                product_id: item.product.id,
                quantity: item.quantity
            }))

        if (dbItems.length > 0) {
            const { error: insertError } = await supabase
                .from('cart_items')
                .insert(dbItems)

            if (insertError) throw insertError
        }

        // Reset recovery sent status because user is active now
        await supabase
            .from('carts')
            .update({ recovery_sent_at: null })
            .eq('id', cart.id)

        return NextResponse.json({ success: true, cart_id: cart.id })

    } catch (error: any) {
        console.error('Cart Sync Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
