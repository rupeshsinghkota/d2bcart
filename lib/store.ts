import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, Product } from '@/types'
import { syncCartToServer } from './cart-sync'

interface CartItem {
    product: Product
    quantity: number
}

interface AppState {
    user: User | null
    cart: CartItem[]
    setUser: (user: User | null) => void
    addToCart: (product: Product, quantity: number) => void
    removeFromCart: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
    getCartTotal: () => number
    addItems: (items: { product: Product, quantity: number }[]) => void
    fetchCart: () => Promise<void>
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            user: null,
            cart: [],

            setUser: (user) => set({ user }),

            addToCart: (product, quantity) => {
                const cart = get().cart
                const existing = cart.find(item => item.product.id === product.id)
                let newCart;

                if (existing) {
                    newCart = cart.map(item =>
                        item.product.id === product.id
                            ? { ...item, quantity: item.quantity + quantity }
                            : item
                    )
                } else {
                    newCart = [...cart, { product, quantity }]
                }

                set({ cart: newCart })
                if (get().user) syncCartToServer(newCart)
            },

            removeFromCart: (productId) => {
                const newCart = get().cart.filter(item => item.product.id !== productId)
                set({ cart: newCart })
                if (get().user) syncCartToServer(newCart)
            },

            updateQuantity: (productId, quantity) => {
                const newCart = get().cart.map(item =>
                    item.product.id === productId ? { ...item, quantity } : item
                )
                set({ cart: newCart })
                if (get().user) syncCartToServer(newCart)
            },

            clearCart: () => {
                set({ cart: [] })
                if (get().user) syncCartToServer([])
            },

            getCartTotal: () => {
                return get().cart.reduce(
                    (total, item) => total + item.product.display_price * item.quantity,
                    0
                )
            },

            addItems: (items: { product: Product, quantity: number }[]) => {
                const currentCart = get().cart
                const newCart = [...currentCart]

                items.forEach(newItem => {
                    const existingItemIndex = newCart.findIndex(item => item.product.id === newItem.product.id)
                    if (existingItemIndex > -1) {
                        newCart[existingItemIndex].quantity += newItem.quantity
                    } else {
                        newCart.push(newItem)
                    }
                })

                set({ cart: newCart })
                if (get().user) syncCartToServer(newCart)
            },

            fetchCart: async () => {
                try {
                    const res = await fetch('/api/cart', {
                        credentials: 'include',
                        cache: 'no-store'
                    })
                    const data = await res.json()
                    if (data.cart && Array.isArray(data.cart)) {
                        const serverCart = data.cart
                        const localCart = get().cart

                        // Smart Sync Logic
                        if (serverCart.length > 0) {
                            // 1. Server has data -> Trust Server (Overwrite local)
                            set({ cart: serverCart })
                        } else if (localCart.length > 0) {
                            // 2. Server is empty, but Local has data -> Trust Local (Push to Server)
                            // This happens on first login with an existing anonymous cart
                            if (get().user) {
                                syncCartToServer(localCart)
                            }
                        }
                        // 3. Both empty -> Do nothing (correctly stays empty)
                    }
                } catch (err) {
                    console.error('Failed to fetch server cart', err)
                }
            }
        }),
        {
            name: 'd2b-cart-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ cart: state.cart }), // Only persist cart, not user session
        }
    )
)
