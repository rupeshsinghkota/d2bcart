
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
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                // 1. Set User in Store
                setUser(session.user as any)

                // 2. Fetch Cart from DB
                await fetchCart()
            }
        }
        init()
    }, [fetchCart, setUser, supabase])

    return null
}
