
import { User, Product } from '@/types'

let syncTimeout: NodeJS.Timeout | null = null

export const syncCartToServer = async (cartItems: { product: Product, quantity: number }[]) => {
    // Debounce: Wait for 2 seconds of inactivity before syncing
    if (syncTimeout) clearTimeout(syncTimeout)

    syncTimeout = setTimeout(async () => {
        try {
            await fetch('/api/cart/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Ensure cookies are sent
                body: JSON.stringify({ items: cartItems }),
            })
            // console.log('Cart synced to server')
        } catch (error) {
            console.error('Failed to sync cart:', error)
        }
    }, 2000)
}
