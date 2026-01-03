'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
    ShoppingCart,
    Trash2,
    Minus,
    Plus,
    ArrowLeft,
    Package,
    CreditCard
} from 'lucide-react'
import Image from 'next/image'
import { calculateTax } from '@/utils/tax'

export default function CartPage() {
    const router = useRouter()
    const { cart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useStore()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [placingOrder, setPlacingOrder] = useState(false)
    // State structure: { [productId]: { selected: { rate, etd, courier, id }, options: [] } }
    const [shippingEstimates, setShippingEstimates] = useState<Record<string, any>>({})
    const [calculatingShipping, setCalculatingShipping] = useState(false)
    const [manufacturerStates, setManufacturerStates] = useState<Record<string, string>>({})

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        if (!isSupabaseConfigured) {
            setLoading(false)
            return
        }
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single()
            setUser(profile)
        }
        setLoading(false)
    }

    // Effect to auto-calculate shipping when User & Cart are ready
    useEffect(() => {
        if (user?.pincode && cart.length > 0) {
            calculateShippingForCart()
        }
    }, [user, cart])

    // Fetch Manufacturer States for Tax Calculation
    useEffect(() => {
        const fetchManufacturerStates = async () => {
            const ids = Array.from(new Set(cart.map(item => item.product.manufacturer_id)))
            if (ids.length === 0) return

            const { data } = await supabase.from('users').select('id, state').in('id', ids)
            if (data) {
                const map: Record<string, string> = {}
                data.forEach((u: any) => map[u.id] = u.state || '')
                setManufacturerStates(map)
            }
        }
        if (cart.length > 0) fetchManufacturerStates()
    }, [cart])

    const calculateShippingForCart = async () => {
        setCalculatingShipping(true)
        const estimates: Record<string, any> = {}

        try {
            // We need to calculate shipping for each item (since they are separate orders)
            // Optimization: In real app, group by manufacturer. Here, we do per item as per order flow.
            await Promise.all(cart.map(async (item) => {
                try {
                    const res = await fetch('/api/shiprocket/estimate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            manufacturer_id: item.product.manufacturer_id,
                            delivery_pincode: user.pincode,
                            weight: (item.product.weight || 0.5) * item.quantity,
                            length: item.product.length || 10,
                            breadth: item.product.breadth || 10,
                            height: item.product.height || 10,
                            cod: 0 // Prepaid
                        })
                    })
                    const data = await res.json()

                    if (data.success) {
                        // Take top 3 options
                        const top3 = data.couriers.slice(0, 3).map((c: any) => ({
                            rate: c.rate,
                            etd: c.etd,
                            courier: c.courier_name,
                            id: c.courier_company_id
                        }))

                        estimates[item.product.id] = {
                            selected: top3[0], // Default to cheapest
                            options: top3
                        }
                    } else {
                        estimates[item.product.id] = { error: 'Not serviceable' }
                    }
                } catch (e) {
                    console.error(e)
                    estimates[item.product.id] = { error: 'Error' }
                }
            }))

            setShippingEstimates(estimates)
        } catch (err) {
            console.error(err)
        } finally {
            setCalculatingShipping(false)
        }
    }

    const setCourierForProduct = (productId: string, courierOption: any) => {
        setShippingEstimates(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                selected: courierOption
            }
        }))
    }

    const getTotalShipping = () => {
        return Object.values(shippingEstimates).reduce((sum, est: any) => sum + (est.selected?.rate || 0), 0)
    }

    const handlePlaceOrder = async () => {
        if (!user) {
            toast.error('Please login to place order')
            router.push('/login')
            return
        }

        if (cart.length === 0) {
            toast.error('Your cart is empty')
            return
        }

        setPlacingOrder(true)

        try {
            // TEST MODE: Direct Order Placement
            // Since Razorpay keys are not configured, we simulate a successful payment

            for (const item of cart) {
                const orderNumber = `D2B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
                const totalAmount = item.product.display_price * item.quantity
                const manufacturerPayout = item.product.base_price * item.quantity
                const platformProfit = item.product.your_margin * item.quantity
                const shipCost = shippingEstimates[item.product.id]?.selected?.rate || 0

                const selectedCourier = shippingEstimates[item.product.id]?.selected

                const taxDetails = calculateTax(
                    item.product.display_price,
                    item.quantity,
                    item.product.tax_rate || 18,
                    manufacturerStates[item.product.manufacturer_id],
                    user.state
                )

                const { error } = await supabase.from('orders').insert({
                    order_number: orderNumber,
                    retailer_id: user.id,
                    manufacturer_id: item.product.manufacturer_id,
                    product_id: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.product.display_price,
                    total_amount: taxDetails.totalAmount, // Now includes tax
                    tax_amount: taxDetails.taxAmount,
                    tax_rate_snapshot: item.product.tax_rate || 18,
                    manufacturer_payout: manufacturerPayout,
                    platform_profit: platformProfit + (shipCost * 0.1),
                    status: 'paid', // Mark as paid for testing
                    shipping_address: user.address || '',
                    shipping_cost: shipCost,
                    courier_name: selectedCourier?.courier || null,
                    courier_company_id: selectedCourier?.id?.toString() || null,
                    payment_id: 'TEST_PAY_SIMULATED_' + Date.now().toString(36),
                    created_at: new Date().toISOString()
                } as any)

                if (error) throw error
            }

            toast.success('Order Placed Successfully (Test Mode)')
            clearCart()
            router.push('/retailer/orders')

        } catch (error: any) {
            console.error('Order Placement Failed:', error)
            toast.error(error.message || 'Failed to place order')
        } finally {
            setPlacingOrder(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32 md:pb-8">
            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200/50 px-4 py-3 flex items-center gap-3">
                <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                </Link>
                <h1 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-emerald-600" />
                    Cart ({cart.length})
                </h1>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-4 md:py-8">
                {/* Desktop Header */}
                <div className="hidden md:block mb-8">
                    <Link
                        href="/products"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Continue Shopping
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShoppingCart className="w-8 h-8 text-emerald-600" />
                        Your Cart
                    </h1>
                </div>

                {cart.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 md:p-12 text-center shadow-sm border border-gray-100">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="w-10 h-10 text-gray-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">
                            Your cart is empty
                        </h2>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Looks like you haven't added any products yet. Start browsing to find great deals!
                        </p>
                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                        >
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Cart Items */}
                        <div className="lg:col-span-2 space-y-4">
                            {cart.map((item) => (
                                <div
                                    key={item.product.id}
                                    className="bg-white rounded-2xl p-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-gray-100 flex gap-4 relative overflow-hidden"
                                >
                                    {/* Product Image */}
                                    <div className="w-24 h-24 bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100">
                                        {item.product.images?.[0] ? (
                                            <div className="relative w-full h-full">
                                                <Image
                                                    src={item.product.images[0]}
                                                    alt={item.product.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <Package className="w-8 h-8 text-gray-300" />
                                        )}
                                    </div>

                                    {/* Content Container */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                        <div>
                                            {/* Header Row: Title & Remove */}
                                            <div className="flex justify-between items-start gap-3">
                                                <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">
                                                    {item.product.name}
                                                </h3>
                                                <button
                                                    onClick={() => removeFromCart(item.product.id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors -mt-1 -mr-1 p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Price & MOQ */}
                                            <div className="mt-1 flex items-baseline gap-2">
                                                <span className="font-bold text-emerald-600">
                                                    {formatCurrency(item.product.display_price)}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    MOQ: {item.product.moq}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Footer Row: Quantity & Total */}
                                        <div className="flex items-end justify-between mt-3">
                                            {/* Compact Quantity Selector */}
                                            <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 h-8">
                                                <button
                                                    onClick={() => updateQuantity(
                                                        item.product.id,
                                                        Math.max(item.product.moq, item.quantity - 1)
                                                    )}
                                                    className="w-8 h-full flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors rounded-l-lg border-r border-gray-200"
                                                >
                                                    <Minus className="w-3 h-3 text-gray-600" />
                                                </button>
                                                <span className="w-8 text-center text-xs font-bold text-gray-900">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                    className="w-8 h-full flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors rounded-r-lg border-l border-gray-200"
                                                >
                                                    <Plus className="w-3 h-3 text-gray-600" />
                                                </button>
                                            </div>

                                            {/* Item Subtotal */}
                                            <div className="flex flex-col items-end leading-none">
                                                <span className="text-[10px] text-gray-400 mb-0.5 font-medium">Total</span>
                                                <span className="text-sm font-bold text-gray-900">
                                                    {formatCurrency(item.product.display_price * item.quantity)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Order Summary */}
                        < div >
                            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
                                <h2 className="font-semibold text-lg mb-4">Order Summary</h2>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Items ({cart.length})</span>
                                        <span>{formatCurrency(getCartTotal())}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal ({cart.length} items)</span>
                                        <span>{formatCurrency(getCartTotal())}</span>
                                    </div>

                                    {/* Tax Summary */}
                                    {cart.map(item => {
                                        const tax = calculateTax(
                                            item.product.display_price,
                                            item.quantity,
                                            item.product.tax_rate || 18,
                                            manufacturerStates[item.product.manufacturer_id],
                                            user?.state
                                        )
                                        return (
                                            <div key={item.product.id} className="flex justify-between text-xs text-gray-500">
                                                <span>Tax ({tax.taxType}) - {item.product.name.substring(0, 15)}...</span>
                                                <span>{formatCurrency(tax.taxAmount)}</span>
                                            </div>
                                        )
                                    })}

                                    <div className="flex justify-between text-gray-600">
                                        <span>Shipping</span>
                                        <span className={calculatingShipping ? "animate-pulse" : "text-emerald-600"}>
                                            {calculatingShipping ? "Calculating..." : formatCurrency(getTotalShipping())}
                                        </span>
                                    </div>
                                    <div className="border-t pt-3 flex justify-between font-bold text-lg">
                                        <span>Total Payable</span>
                                        <span className="text-emerald-600">
                                            {formatCurrency(
                                                getCartTotal() +
                                                getTotalShipping() +
                                                cart.reduce((sum, item) => sum + calculateTax(
                                                    item.product.display_price,
                                                    item.quantity,
                                                    item.product.tax_rate || 18,
                                                    manufacturerStates[item.product.manufacturer_id],
                                                    user?.state
                                                ).taxAmount, 0)
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handlePlaceOrder}
                                    disabled={placingOrder || cart.length === 0}
                                    className="w-full btn-primary flex items-center justify-center gap-2"
                                >
                                    {placingOrder ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CreditCard className="w-5 h-5" />
                                            Place Order
                                        </>
                                    )}
                                </button>

                                <p className="text-xs text-gray-500 text-center mt-3">
                                    Secure checkout • Direct from manufacturer
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Sticky Bottom Checkout Bar */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 p-4 z-40 safe-area-inset-bottom">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs text-gray-500">{cart.length} item(s)</p>
                            <p className="text-lg font-bold text-gray-900">
                                {formatCurrency(
                                    getCartTotal() +
                                    getTotalShipping() +
                                    cart.reduce((sum, item) => sum + calculateTax(
                                        item.product.display_price,
                                        item.quantity,
                                        item.product.tax_rate || 18,
                                        manufacturerStates[item.product.manufacturer_id],
                                        user?.state
                                    ).taxAmount, 0)
                                )}
                            </p>
                        </div>
                        <button
                            onClick={handlePlaceOrder}
                            disabled={placingOrder || cart.length === 0}
                            className="flex-1 max-w-[200px] py-3 bg-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                        >
                            {placingOrder ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CreditCard className="w-5 h-5" />
                                    Checkout
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div >
    )
}
