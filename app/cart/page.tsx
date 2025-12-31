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

export default function CartPage() {
    const router = useRouter()
    const { cart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useStore()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [placingOrder, setPlacingOrder] = useState(false)
    // State structure: { [productId]: { selected: { rate, etd, courier, id }, options: [] } }
    const [shippingEstimates, setShippingEstimates] = useState<Record<string, any>>({})
    const [calculatingShipping, setCalculatingShipping] = useState(false)

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

                const { error } = await supabase.from('orders').insert({
                    order_number: orderNumber,
                    retailer_id: user.id,
                    manufacturer_id: item.product.manufacturer_id,
                    product_id: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.product.display_price,
                    total_amount: totalAmount,
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
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/products"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Continue Shopping
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <ShoppingCart className="w-8 h-8 text-emerald-600" />
                        Shopping Cart
                    </h1>
                </div>

                {cart.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-600 mb-2">
                            Your cart is empty
                        </h2>
                        <p className="text-gray-500 mb-6">
                            Start adding products to place an order
                        </p>
                        <Link href="/products" className="btn-primary inline-block">
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
                                    className="bg-white rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4"
                                >
                                    {/* Product Image */}
                                    <div className="w-full sm:w-24 h-48 sm:h-24 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {item.product.images?.[0] ? (
                                            <img
                                                src={item.product.images[0]}
                                                alt={item.product.name}
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        ) : (
                                            <Package className="w-8 h-8 text-gray-400" />
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate">
                                            {item.product.name}
                                        </h3>
                                        <p className="text-emerald-600 font-bold mt-1">
                                            {formatCurrency(item.product.display_price)} / unit
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            MOQ: {item.product.moq} units
                                        </p>

                                        {/* Quantity Controls */}
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="flex items-center border rounded-lg">
                                                <button
                                                    onClick={() => updateQuantity(
                                                        item.product.id,
                                                        Math.max(item.product.moq, item.quantity - 1)
                                                    )}
                                                    className="p-2 hover:bg-gray-100"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <span className="px-4 font-medium">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                    className="p-2 hover:bg-gray-100"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.product.id)}
                                                className="text-red-500 hover:text-red-600 p-2"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Item Total */}
                                    <div className="text-left sm:text-right min-w-[100px] mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0">
                                        <div className="flex justify-between sm:block items-center">
                                            <span className="sm:hidden text-gray-500 font-medium">Subtotal</span>
                                            <p className="text-lg font-bold text-gray-900">
                                                {formatCurrency(item.product.display_price * item.quantity)}
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-1">{item.quantity} units</p>

                                        {/* Shipping Selection */}
                                        {user?.pincode ? (
                                            shippingEstimates[item.product.id] ? (
                                                shippingEstimates[item.product.id].error ? (
                                                    <p className="text-xs text-red-500">Not Deliverable</p>
                                                ) : (
                                                    <div className="mt-2 text-left bg-gray-50 p-2 rounded-lg">
                                                        <p className="text-xs font-semibold text-gray-500 mb-1">Select Shipping:</p>
                                                        <div className="space-y-1">
                                                            {shippingEstimates[item.product.id].options.map((option: any, index: number) => (
                                                                <div
                                                                    key={option.id}
                                                                    onClick={() => setCourierForProduct(item.product.id, option)}
                                                                    className={`flex items-center justify-between p-1.5 rounded cursor-pointer border ${shippingEstimates[item.product.id].selected.id === option.id
                                                                        ? 'bg-emerald-50 border-emerald-200'
                                                                        : 'bg-white border-transparent hover:border-gray-200'
                                                                        }`}
                                                                >
                                                                    <div className="text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium text-gray-900">{option.courier}</span>
                                                                            {index === 0 && (
                                                                                <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                                                                    Best Value
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-gray-500">Est. {option.etd || '2-5 Days'}</span>
                                                                    </div>
                                                                    <div className="text-xs font-bold text-gray-900">
                                                                        {formatCurrency(option.rate)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <p className="text-xs text-gray-400 animate-pulse mt-2">Checking Couriers...</p>
                                            )
                                        ) : (
                                            <p className="text-xs text-amber-600 mt-2">Add Address for Rates</p>
                                        )}
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
                                        <span>Items ({cart.length})</span>
                                        <span>{formatCurrency(getCartTotal())}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Shipping</span>
                                        <span className={calculatingShipping ? "animate-pulse" : "text-emerald-600"}>
                                            {calculatingShipping ? "Calculating..." : formatCurrency(getTotalShipping())}
                                        </span>
                                    </div>
                                    <div className="border-t pt-3 flex justify-between font-bold text-lg">
                                        <span>Total</span>
                                        <span className="text-emerald-600">{formatCurrency(getCartTotal() + getTotalShipping())}</span>
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
        </div >
    )
}
