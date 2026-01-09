
'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { createBrowserClient } from '@supabase/ssr'

export default function CartSyncProvider() {
    const fetchCart = useStore(state => state.fetchCart)
    const setUser = useStore(state => state.setUser)

    // Initialize Client for Browser
    // Note: We use environmental variables directly
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        const performSync = async (uid: string) => {
            try {
                // 1. Get Cart ID
                const { data: cart } = await supabase
                    .from('carts')
                    .select('id')
                    .eq('user_id', uid)
                    .maybeSingle()

                if (!cart) {
                    // No cart on server -> Let mergeRemoteCart handle logic (it might save local)
                    useStore.getState().mergeRemoteCart([])
                    return
                }

                // 2. Get Cart Items
                const { data: cartItems } = await supabase
                    .from('cart_items')
                    .select(`
                        quantity,
                        product:products (
                            id, name, display_price, images, manufacturer_id, moq
                        )
                    `)
                    .eq('cart_id', cart.id)

                // 3. Transform to Store Format
                const formattedItems = (cartItems || []).map((item: any) => ({
                    product: {
                        id: item.product.id,
                        name: item.product.name,
                        display_price: item.product.display_price,
                        images: item.product.images || [],
                        manufacturer_id: item.product.manufacturer_id,
                        moq: item.product.moq || 1,
                        // Defaults
                        base_price: 0, your_margin: 0, stock: 999, is_active: true, created_at: new Date().toISOString(), category_id: ''
                    },
                    quantity: item.quantity
                }))

                // 4. Merge
                useStore.getState().mergeRemoteCart(formattedItems)

            } catch (err) {
                console.error('Sync failed', err)
            }
        }

        // Initial Check
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUser(session.user as any)
                performSync(session.user.id)
            }
        }
        init()

        // Real-time Auth Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                setUser(session.user as any)
                performSync(session.user.id)
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [setUser, supabase])

    return null
}
