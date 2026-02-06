import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, Product } from '@/types'
import { syncCartToServer } from './cart-sync'
import toast from 'react-hot-toast'

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
    mergeRemoteCart: (items: CartItem[]) => void
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            user: null,
            cart: [],

            setUser: (user) => set({ user }),

            addToCart: (product, quantity) => {
                const cart = get().cart
                const moq = product.moq || 1
                const existing = cart.find(item => item.product.id === product.id)
                let newCart;

                // Enforce MOQ - can't add less than MOQ
                if (quantity < moq) {
                    toast.error(`Minimum order quantity for this item is ${moq}`)
                    return
                }

                // Enforce Multiples of MOQ
                if (quantity % moq !== 0) {
                    toast.error(`Quantity must be a multiple of ${moq}`)
                    return
                }

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
                const cart = get().cart
                const item = cart.find(i => i.product.id === productId)
                if (!item) return

                const moq = item.product.moq || 1

                // Enforce MOQ - can't reduce below MOQ
                if (quantity < moq) {
                    toast.error(`Minimum order quantity is ${moq}`)
                    return
                }

                // Enforce Multiples of MOQ
                if (quantity % moq !== 0) {
                    toast.error(`Quantity must be a multiple of ${moq}`)
                    return
                }

                const newCart = cart.map(item =>
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

            // Accepts cart items fetched by an authenticated client (e.g., CartSyncProvider)
            mergeRemoteCart: (serverCart: CartItem[]) => {
                const localCart = get().cart
                const user = get().user

                // Smart Sync Logic
                if (serverCart.length > 0) {
                    // 1. Server has data -> Trust Server (Overwrite local)
                    set({ cart: serverCart })
                    toast.success('Cart loaded from account')
                } else if (localCart.length > 0) {
                    // 2. Server is empty, but Local has data -> Trust Local (Push to Server)
                    if (user) {
                        syncCartToServer(localCart)
                        toast.success('Cart saved to account')
                    }
                }
                // 3. Both empty -> Do nothing
            },

            // Legacy fetch (kept for compatibility but won't be used)
            fetchCart: async () => { }
        }),
        {
            name: 'd2b-cart-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ cart: state.cart }), // Only persist cart, not user session
        }
    )
)
