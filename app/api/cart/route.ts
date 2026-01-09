
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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
                    } catch { }
                },
            },
        }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
        return NextResponse.json({ cart: [] })
    }

    try {
        const { data: cartItems } = await supabase
            .from('cart_items')
            .select(`
                quantity,
                product:products (
                    id,
                    name,
                    display_price,
                    images,
                    manufacturer_id,
                    moq
                )
            `)
            .eq('cart_id', (
                await supabase.from('carts').select('id').eq('user_id', session.user.id).single()
            ).data?.id)

        // Transform to match store format
        // The join returns Product as an object, which matches the Store's Product type structure roughly (subset)
        // We might need to cast or map strictly if types mismatch, but usually this is fine for display
        const formattedCart = (cartItems || []).map((item: any) => ({
            product: {
                // Ensure we map all required fields for the UI
                id: item.product.id,
                name: item.product.name,
                display_price: item.product.display_price,
                images: item.product.images || [],
                manufacturer_id: item.product.manufacturer_id,
                moq: item.product.moq || 1,
                // Add default values for missing required Product fields to avoid crashes
                base_price: 0,
                your_margin: 0,
                stock: 999,
                is_active: true,
                created_at: new Date().toISOString(),
                category_id: ''
            },
            quantity: item.quantity
        }))

        return NextResponse.json({ cart: formattedCart })

    } catch (error: any) {
        console.error('Get Cart Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
