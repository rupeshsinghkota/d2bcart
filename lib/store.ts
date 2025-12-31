import { create } from 'zustand'
import { User, Product } from '@/types'

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
}

export const useStore = create<AppState>((set, get) => ({
    user: null,
    cart: [],

    setUser: (user) => set({ user }),

    addToCart: (product, quantity) => {
        const cart = get().cart
        const existing = cart.find(item => item.product.id === product.id)

        if (existing) {
            set({
                cart: cart.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                )
            })
        } else {
            set({ cart: [...cart, { product, quantity }] })
        }
    },

    removeFromCart: (productId) => {
        set({ cart: get().cart.filter(item => item.product.id !== productId) })
    },

    updateQuantity: (productId, quantity) => {
        set({
            cart: get().cart.map(item =>
                item.product.id === productId ? { ...item, quantity } : item
            )
        })
    },

    clearCart: () => set({ cart: [] }),

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
    },
}))
