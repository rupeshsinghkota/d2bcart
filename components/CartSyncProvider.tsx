
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
        // Initial Check
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUser(session.user as any)
                fetchCart()
            }
        }
        init()

        // Real-time Auth Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                setUser(session.user as any)
                fetchCart() // Trigger sync immediately on login
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                // Optionally clear cart or keep local
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [fetchCart, setUser, supabase])

    return null
}
