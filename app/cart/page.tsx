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
    CreditCard,
    Truck,
    Clock,
    ChevronDown,
    Store,
    ChevronUp,
    Shield,
    Percent,
    ShieldCheck,
    Building,
    FileText,
    MapPin
} from 'lucide-react'
import Image from 'next/image'
import { calculateTax } from '@/utils/tax'

// Razorpay Type Definition
declare global {
    interface Window {
        Razorpay: any;
    }
}

// Minimum order value per seller (₹5000)
const MIN_ORDER_PER_SELLER = 3999

// Advance payment percentage
const ADVANCE_PAYMENT_PERCENT = 0

type PaymentOption = 'advance' | 'full'

export default function CartPage() {
    const router = useRouter()
    const { cart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useStore()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [placingOrder, setPlacingOrder] = useState(false)
    // State structure: { [manufacturerId]: { selected: { rate, etd, courier, id }, options: [], totalWeight: number } }
    const [shippingEstimates, setShippingEstimates] = useState<Record<string, any>>({})
    const [calculatingShipping, setCalculatingShipping] = useState(false)
    const [manufacturerStates, setManufacturerStates] = useState<Record<string, string>>({})
    const [shippingPincode, setShippingPincode] = useState('')

    // Payment option: 'advance' = 20% + shipping, 'full' = 100% + shipping
    const [paymentOption, setPaymentOption] = useState<PaymentOption>('full')

    // Group cart items by manufacturer
    const getItemsByManufacturer = () => {
        const grouped: Record<string, typeof cart> = {}
        cart.forEach(item => {
            const mfId = item.product.manufacturer_id
            if (!grouped[mfId]) grouped[mfId] = []
            grouped[mfId].push(item)
        })
        return grouped
    }

    // Calculate total product value for a seller (without shipping)
    const getSellerProductTotal = (mfId: string) => {
        const items = getItemsByManufacturer()[mfId] || []
        return items.reduce((sum, item) => sum + (item.product.display_price * item.quantity), 0)
    }

    // Check if all sellers meet the minimum order value
    const getSellersBelowMinimum = () => {
        const itemsByMfr = getItemsByManufacturer()
        const belowMinimum: { mfId: string; total: number; shortfall: number }[] = []

        Object.keys(itemsByMfr).forEach(mfId => {
            const total = getSellerProductTotal(mfId)
            if (total < MIN_ORDER_PER_SELLER) {
                belowMinimum.push({
                    mfId,
                    total,
                    shortfall: MIN_ORDER_PER_SELLER - total
                })
            }
        })

        return belowMinimum
    }

    const allSellersMeetMinimum = () => getSellersBelowMinimum().length === 0

    useEffect(() => {
        checkUser()
        loadRazorpayScript()
    }, [])

    // Facebook Pixel: InitiateCheckout
    useEffect(() => {
        if (cart.length > 0 && !loading) {
            import('@/lib/fpixel').then((fpixel) => {
                fpixel.event('InitiateCheckout', {
                    content_ids: cart.map(item => item.product.id),
                    content_type: 'product',
                    currency: 'INR',
                    value: getCartTotal(),
                    num_items: cart.length
                })
            })
        }
    }, [cart.length, loading])

    const loadRazorpayScript = () => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        document.body.appendChild(script)
    }

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
            if ((profile as any)?.pincode) setShippingPincode((profile as any).pincode)
        }
        setLoading(false)
    }

    // Effect to auto-calculate shipping when Pincode & Cart are ready
    useEffect(() => {
        if (shippingPincode && shippingPincode.length === 6 && cart.length > 0) {
            calculateShippingForCart()
        }
    }, [shippingPincode, cart, paymentOption])

    // Store manufacturer info for display
    const [manufacturerInfo, setManufacturerInfo] = useState<Record<string, { state: string; name: string }>>({})

    // Fetch Manufacturer States and Names for Tax Calculation & Display
    useEffect(() => {
        const fetchManufacturerInfo = async () => {
            const ids = Array.from(new Set(cart.map(item => item.product.manufacturer_id)))
            if (ids.length === 0) return

            const { data } = await supabase.from('users').select('id, state, business_name').in('id', ids)
            if (data) {
                const stateMap: Record<string, string> = {}
                const infoMap: Record<string, { state: string; name: string }> = {}
                data.forEach((u: any) => {
                    stateMap[u.id] = u.state || ''
                    infoMap[u.id] = { state: u.state || '', name: u.business_name || 'Seller' }
                })
                setManufacturerStates(stateMap)
                setManufacturerInfo(infoMap)
            }
        }
        if (cart.length > 0) fetchManufacturerInfo()
    }, [cart])

    // Calculate shipping GROUPED BY MANUFACTURER
    const calculateShippingForCart = async () => {
        setCalculatingShipping(true)
        const estimates: Record<string, any> = {}
        const itemsByMfr = getItemsByManufacturer()

        try {
            await Promise.all(Object.entries(itemsByMfr).map(async ([manufacturerId, items]) => {
                try {
                    // Combine weight and find max dimensions
                    let totalWeight = 0
                    let maxLength = 10, maxBreadth = 10, maxHeight = 10

                    items.forEach(item => {
                        // Weight is per MOQ pack, so calculate effective weight per unit
                        const moq = item.product.moq || 1
                        const weightPerUnit = (item.product.weight || 0.5) / moq
                        totalWeight += weightPerUnit * item.quantity

                        maxLength = Math.max(maxLength, item.product.length || 10)
                        maxBreadth = Math.max(maxBreadth, item.product.breadth || 10)
                        maxHeight = Math.max(maxHeight, item.product.height || 10)
                    })

                    const res = await fetch('/api/shiprocket/estimate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            manufacturer_id: manufacturerId,
                            delivery_pincode: shippingPincode,
                            weight: totalWeight,
                            length: maxLength,
                            breadth: maxBreadth,
                            height: maxHeight,
                            cod: paymentOption === 'advance' ? 1 : 0 // 1 = COD, 0 = Prepaid
                        })
                    })
                    const data = await res.json()

                    if (data.success) {
                        const top3 = data.couriers.slice(0, 3).map((c: any) => ({
                            rate: c.rate,
                            etd: c.etd,
                            courier: c.courier_name,
                            id: c.courier_company_id
                        }))

                        estimates[manufacturerId] = {
                            selected: top3[0], // Default to cheapest
                            options: top3,
                            totalWeight: totalWeight.toFixed(2),
                            itemCount: items.length
                        }
                    } else {
                        estimates[manufacturerId] = { error: 'Not serviceable' }
                    }
                } catch (e) {
                    console.error(e)
                    estimates[manufacturerId] = { error: 'Error calculating shipping' }
                }
            }))

            setShippingEstimates(estimates)
        } catch (err) {
            console.error(err)
        } finally {
            setCalculatingShipping(false)
        }
    }

    const setCourierForManufacturer = (manufacturerId: string, courierOption: any) => {
        setShippingEstimates(prev => ({
            ...prev,
            [manufacturerId]: {
                ...prev[manufacturerId],
                selected: courierOption
            }
        }))
    }

    const getTotalShipping = () => {
        return Object.values(shippingEstimates).reduce((sum, est: any) => sum + (est.selected?.rate || 0), 0)
    }

    // Calculate payment amounts based on selected option
    const getAdvanceAmount = () => {
        const productTotal = getCartTotal()
        const shipping = getTotalShipping()
        const advanceProductAmount = Math.ceil(productTotal * (ADVANCE_PAYMENT_PERCENT / 100))
        return advanceProductAmount + shipping
    }

    const getFullAmount = () => {
        return getCartTotal() + getTotalShipping()
    }

    const getRemainingAmount = () => {
        const productTotal = getCartTotal()
        return Math.floor(productTotal * ((100 - ADVANCE_PAYMENT_PERCENT) / 100))
    }

    const getPayableAmount = () => {
        return paymentOption === 'advance' ? getAdvanceAmount() : getFullAmount()
    }

    const [guestForm, setGuestForm] = useState({
        name: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
    })

    // Load persisted pincode from Product Page
    useEffect(() => {
        const storedPin = localStorage.getItem('d2b_pincode')
        if (storedPin && storedPin.length === 6) {
            setGuestForm(prev => ({ ...prev, pincode: storedPin }))
            if (!user) {
                setShippingPincode(storedPin)
            }
        }
    }, [user])

    const handleGuestInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setGuestForm(prev => ({ ...prev, [name]: value }))
    }

    const handlePlaceOrder = async () => {
        let currentUser = user

        // GUEST CHECKOUT LOGIC
        if (!currentUser) {
            // Validate Guest Form
            if (!guestForm.name || !guestForm.phone || !guestForm.address || !guestForm.pincode || guestForm.phone.length < 10) {
                toast.error('Please fill all shipping details correctly')
                return // Stop here, show validation error
            }

            setPlacingOrder(true) // Start loading UI
            const toastId = toast.loading('Creating your account...')

            try {
                // Auto-Register Guest
                const regRes = await fetch('/api/auth/guest-register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(guestForm)
                })
                const regData = await regRes.json()

                if (!regRes.ok) {
                    toast.dismiss(toastId)
                    if (regRes.status === 409) {
                        toast.error(regData.message) // "User exists, please login"
                        router.push('/login')
                    } else {
                        toast.error(regData.error || 'Registration failed')
                    }
                    setPlacingOrder(false)
                    return
                }

                // Auto-Login
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    phone: `+91${guestForm.phone}`,
                    password: regData.password
                })

                if (loginError) {
                    // Fallback to email login if phone fail? Or just proceed with user_id?
                    // If login fails, we can't persist session, but we HAVE the user_id for the order.
                    // For now, let's treat login error as non-blocking for the ORDER, but warn.
                    console.error("Auto-login failed", loginError)
                }

                toast.success('Account created! Proceeding to payment...', { id: toastId })

                // Update local user state so shipping/order logic works
                currentUser = {
                    id: regData.user_id,
                    ...guestForm,
                    business_name: guestForm.name,
                    email: regData.email // Important for Razorpay prefill
                }
                setUser(currentUser)

            } catch (err: any) {
                toast.dismiss(toastId)
                toast.error(err.message)
                setPlacingOrder(false)
                return
            }
        }

        // --- Original Check Logic (modified to use currentUser) ---
        if (!currentUser) {
            setPlacingOrder(false)
            return
        }

        if (cart.length === 0) {
            toast.error('Your cart is empty')
            return
        }

        // Check for shipping errors (now keyed by manufacturer, not product)
        const manufacturerIds = Array.from(new Set(cart.map(item => item.product.manufacturer_id)))
        const hasShippingError = manufacturerIds.some(mfId => shippingEstimates[mfId]?.error)
        if (hasShippingError) {
            toast.error('Some items are not serviceable to your location.')
            return
        }

        // Check minimum order value per seller
        const belowMinimum = getSellersBelowMinimum()
        if (belowMinimum.length > 0) {
            const sellerName = manufacturerInfo[belowMinimum[0].mfId]?.name || 'Seller'
            toast.error(`Minimum order value per seller is ₹${MIN_ORDER_PER_SELLER.toLocaleString()}. Add ₹${belowMinimum[0].shortfall.toLocaleString()} more from ${sellerName}.`)
            return
        }

        // Wait for shipping calculation (one estimate per manufacturer)
        if (Object.keys(shippingEstimates).length < manufacturerIds.length) {
            toast.error('Please wait for shipping estimates to load')
            return
        }

        setPlacingOrder(true)

        try {
            // Group items by manufacturer for shipping cost distribution
            const itemsByMfr = getItemsByManufacturer()

            // 1. Calculate Totals (prices are GST-inclusive)
            let totalProductAmount = 0
            let totalShippingAmount = getTotalShipping() // Uses manufacturer-based rates

            cart.forEach(item => {
                totalProductAmount += item.product.display_price * item.quantity
            })

            const grandTotal = totalProductAmount + totalShippingAmount

            // Calculate payable amount based on payment option
            const payableAmount = paymentOption === 'advance'
                ? Math.ceil(totalProductAmount * (ADVANCE_PAYMENT_PERCENT / 100)) + totalShippingAmount
                : grandTotal

            const remainingBalance = paymentOption === 'advance'
                ? Math.floor(totalProductAmount * ((100 - ADVANCE_PAYMENT_PERCENT) / 100))
                : 0

            // 2. Create Razorpay Order with payable amount
            const orderRes = await fetch('/api/razorpay/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: payableAmount })
            })

            if (!orderRes.ok) {
                const error = await orderRes.json()
                throw new Error(error.error || 'Failed to create payment order')
            }

            const razorpayOrder = await orderRes.json()


            // 3. Prepare Cart Payload for Post-Payment Creation
            // We do NOT create orders in DB yet. We wait for payment success.
            const processedManufacturers = new Set<string>()
            const cartPayload = cart.map(item => {
                const mfId = item.product.manufacturer_id

                // Only first item from each manufacturer gets shipping cost
                const isFirstItemFromMfr = !processedManufacturers.has(mfId)
                const shipCost = isFirstItemFromMfr ? (shippingEstimates[mfId]?.selected?.rate || 0) : 0
                const selectedCourier = shippingEstimates[mfId]?.selected

                processedManufacturers.add(mfId)

                return {
                    manufacturer_id: mfId,
                    product_id: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.product.display_price,
                    base_price: item.product.base_price,
                    your_margin: item.product.your_margin,
                    tax_rate: item.product.tax_rate || 18,
                    ship_cost: shipCost,
                    courier_name: selectedCourier?.courier || null,
                    courier_company_id: selectedCourier?.id?.toString() || null,
                }
            })

            // 4. Open Razorpay Checkout
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                name: 'D2B Cart',
                description: 'Order Payment',
                order_id: razorpayOrder.id,
                handler: async function (response: any) {
                    // 5. Verify Payment & Create Order
                    try {
                        const verifyRes = await fetch('/api/razorpay/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                cart_payload: cartPayload, // Pass the cart data
                                user_id: currentUser.id, // Use currentUser
                                user_address: {
                                    address: currentUser.address,
                                    city: currentUser.city,
                                    state: currentUser.state || '', // Handle potential missing state
                                    pincode: currentUser.pincode
                                },
                                payment_option: paymentOption,
                                payment_breakdown: {
                                    total_product_amount: totalProductAmount,
                                    total_shipping_amount: totalShippingAmount,
                                    payable_amount: payableAmount,
                                    remaining_balance: remainingBalance
                                }
                            })
                        })

                        const verifyData = await verifyRes.json()
                        if (verifyData.success) {
                            // Facebook Pixel: Purchase
                            import('@/lib/fpixel').then((fpixel) => {
                                fpixel.event('Purchase', {
                                    content_type: 'product',
                                    content_ids: cart.map(item => item.product.id),
                                    value: payableAmount,
                                    currency: 'INR',
                                    num_items: cart.length,
                                    transaction_id: response.razorpay_payment_id,
                                })
                            })

                            toast.success('Payment Successful!')
                            clearCart()
                            router.push('/retailer/orders')
                        } else {
                            toast.error('Payment Verification Failed')
                            console.error('Verification Error', verifyData)
                        }

                    } catch (verifyError) {
                        console.error('Verification Exception', verifyError)
                        toast.error('Payment verification failed after success')
                    }
                },
                prefill: {
                    name: currentUser.business_name || currentUser.full_name, // Use currentUser
                    email: currentUser.email,
                    contact: currentUser.phone
                },
                theme: {
                    color: '#059669'
                },
                modal: {
                    ondismiss: function () {
                        setPlacingOrder(false)
                        toast('Payment Cancelled')
                    }
                }
            }

            const rzp1 = new window.Razorpay(options)
            rzp1.open()

        } catch (error: any) {
            console.error('Order Placement Failed:', error)
            toast.error(error.message || 'Failed to place order')
            setPlacingOrder(false) // Only stop loading if error before modal open
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
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-36 md:pb-8">
            {/* Mobile Header - Enhanced */}
            <div className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-gray-900 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                                Cart
                            </h1>
                            <p className="text-xs text-gray-500">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    {cart.length > 0 && (
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-bold text-emerald-600">{formatCurrency(getCartTotal())}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
                {/* Desktop Header - Enhanced */}
                <div className="hidden md:flex md:items-center md:justify-between mb-8">
                    <div>
                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-3 transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Continue Shopping
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                            </div>
                            Your Cart
                            <span className="text-lg font-normal text-gray-400">({cart.length} items)</span>
                        </h1>
                    </div>
                    {cart.length > 0 && (
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Estimated Total</p>
                            <p className="text-2xl font-bold text-emerald-600">
                                {formatCurrency(getCartTotal() + getTotalShipping())}
                            </p>
                        </div>
                    )}
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
                    <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
                        {/* Cart Items - Grouped by Seller */}
                        <div className="lg:col-span-2 space-y-6">
                            {Object.entries(getItemsByManufacturer()).map(([mfId, items]) => {
                                const sellerTotal = getSellerProductTotal(mfId)
                                const isBelowMinimum = sellerTotal < MIN_ORDER_PER_SELLER
                                const shortfall = MIN_ORDER_PER_SELLER - sellerTotal

                                return (
                                    <div key={mfId} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isBelowMinimum ? 'border-amber-300' : 'border-gray-100'}`}>
                                        {/* Seller Header */}
                                        <div className="bg-gradient-to-r from-gray-50 to-white px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isBelowMinimum ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                                                    <Store className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isBelowMinimum ? 'text-amber-600' : 'text-emerald-600'}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                                                        {manufacturerInfo[mfId]?.name || 'Seller'}
                                                    </h3>
                                                    <p className="text-[10px] sm:text-xs text-gray-500">
                                                        {items.length} item{items.length > 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-[10px] sm:text-xs text-gray-500">Subtotal</p>
                                                <p className={`font-bold text-sm sm:text-base ${isBelowMinimum ? 'text-amber-600' : 'text-gray-900'}`}>
                                                    {formatCurrency(sellerTotal)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Minimum Order Warning */}
                                        {isBelowMinimum && (
                                            <div className="bg-amber-50 px-3 sm:px-4 py-2 border-b border-amber-100 flex items-center gap-2">
                                                <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <span className="text-amber-600 text-xs font-bold">!</span>
                                                </div>
                                                <p className="text-xs text-amber-800">
                                                    Add <span className="font-bold">{formatCurrency(shortfall)}</span> more to meet ₹{MIN_ORDER_PER_SELLER.toLocaleString()} minimum
                                                </p>
                                            </div>
                                        )}

                                        {/* Products from this Seller */}
                                        <div className="divide-y divide-gray-50">
                                            {items.map((item) => (
                                                <div
                                                    key={item.product.id}
                                                    className="p-3 sm:p-4 flex gap-3 sm:gap-4 hover:bg-gray-50/50 transition-colors"
                                                >
                                                    {/* Product Image */}
                                                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg sm:rounded-xl flex-shrink-0 overflow-hidden">
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
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Package className="w-8 h-8 text-gray-300" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="font-medium text-gray-900 line-clamp-2 text-xs sm:text-sm md:text-base leading-snug pr-1">
                                                                    {item.product.name}
                                                                </h4>
                                                                <button
                                                                    onClick={() => removeFromCart(item.product.id)}
                                                                    className="text-gray-300 hover:text-red-500 active:text-red-600 transition-colors p-1.5 -m-1 flex-shrink-0"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                                <span className="text-emerald-600 font-bold text-sm sm:text-base">
                                                                    {formatCurrency(item.product.display_price)}
                                                                </span>
                                                                <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                                                                    MOQ: {item.product.moq}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Quantity & Total */}
                                                        <div className="flex items-center justify-between mt-2 sm:mt-3">
                                                            <div className="flex items-center bg-gray-100 rounded-lg sm:rounded-xl h-8 sm:h-9 md:h-10">
                                                                <button
                                                                    onClick={() => updateQuantity(
                                                                        item.product.id,
                                                                        Math.max(item.product.moq, item.quantity - (item.product.moq || 1))
                                                                    )}
                                                                    className="w-8 sm:w-9 md:w-10 h-full flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 transition-colors rounded-l-lg sm:rounded-l-xl"
                                                                >
                                                                    <Minus className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-600" />
                                                                </button>
                                                                <span className="w-8 sm:w-10 md:w-12 text-center text-xs sm:text-sm font-bold text-gray-900">
                                                                    {item.quantity}
                                                                </span>
                                                                <button
                                                                    onClick={() => updateQuantity(item.product.id, item.quantity + (item.product.moq || 1))}
                                                                    className="w-8 sm:w-9 md:w-10 h-full flex items-center justify-center hover:bg-gray-200 active:bg-gray-300 transition-colors rounded-r-lg sm:rounded-r-xl"
                                                                >
                                                                    <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-600" />
                                                                </button>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
                                                                <p className="font-bold text-gray-900 text-sm sm:text-base">
                                                                    {formatCurrency(item.product.display_price * item.quantity)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Shipping Section for this Seller */}
                                        <div className="bg-emerald-50/50 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-emerald-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-emerald-800">
                                                    <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                    <span>Shipping</span>
                                                    {shippingEstimates[mfId] && !shippingEstimates[mfId].error && (
                                                        <span className="text-[10px] sm:text-xs text-emerald-600 font-normal hidden sm:inline">
                                                            ({shippingEstimates[mfId].totalWeight}kg)
                                                        </span>
                                                    )}
                                                </div>
                                                {shippingEstimates[mfId]?.selected && (
                                                    <span className="text-xs sm:text-sm font-bold text-emerald-600">
                                                        {formatCurrency(shippingEstimates[mfId].selected.rate)}
                                                    </span>
                                                )}
                                            </div>

                                            {calculatingShipping && !shippingEstimates[mfId] ? (
                                                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500 py-1.5 sm:py-2">
                                                    <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                    Calculating...
                                                </div>
                                            ) : shippingEstimates[mfId]?.error ? (
                                                <div className="text-[10px] sm:text-xs text-red-500 flex items-center gap-1 py-1.5 sm:py-2">
                                                    <Truck className="w-3 h-3" />
                                                    {shippingEstimates[mfId].error}
                                                </div>
                                            ) : shippingEstimates[mfId] ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    {shippingEstimates[mfId].options?.map((opt: any, idx: number) => (
                                                        <label
                                                            key={idx}
                                                            className={`relative flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-white ${shippingEstimates[mfId].selected?.id === opt.id
                                                                ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-sm bg-emerald-50'
                                                                : 'border-gray-200 hover:border-emerald-300'
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name={`courier-${mfId}`}
                                                                checked={shippingEstimates[mfId].selected?.id === opt.id}
                                                                onChange={() => setCourierForManufacturer(mfId, opt)}
                                                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-medium text-gray-900 truncate">{opt.courier}</div>
                                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> {opt.etd}
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-bold text-emerald-600">{formatCurrency(opt.rate)}</div>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Guest / User Shipping Details */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-emerald-600" />
                                Shipping Details
                            </h3>

                            {user ? (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-gray-900">{user.business_name || user.full_name}</p>
                                        <p className="text-sm text-gray-600 mt-1">{user.address}</p>
                                        <p className="text-sm text-gray-600">{user.city}, {user.state} - {user.pincode}</p>
                                        <p className="text-sm text-gray-600 mt-1">Mobile: {user.phone}</p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/profile')}
                                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm"
                                    >
                                        Change
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name / Business Name</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={guestForm.name}
                                                onChange={handleGuestInput}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                                placeholder="Enter name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={guestForm.phone}
                                                onChange={handleGuestInput}
                                                maxLength={10}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                                placeholder="10-digit mobile number"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                        <textarea
                                            name="address"
                                            value={guestForm.address}
                                            onChange={handleGuestInput}
                                            rows={2}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                                            placeholder="Full delivery address"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                                            <input
                                                type="text"
                                                name="pincode"
                                                value={guestForm.pincode}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                                                    setGuestForm(prev => ({ ...prev, pincode: val }))
                                                    // Trigger shipping calc if 6 digits
                                                    if (val.length === 6) {
                                                        setShippingPincode(val)
                                                    }
                                                }}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                                placeholder="Pin Code"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={guestForm.city}
                                                onChange={handleGuestInput}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                                placeholder="City"
                                            />
                                        </div>
                                        <div className="col-span-2 lg:col-span-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                            <input
                                                type="text"
                                                name="state"
                                                value={guestForm.state}
                                                onChange={handleGuestInput}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                                placeholder="State"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        Your account will be created automatically for order tracking.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Order Summary */}
                        < div >
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-24 overflow-hidden">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-emerald-50 to-white px-5 py-4 border-b border-gray-100">
                                    <h2 className="font-bold text-lg text-gray-900">Order Summary</h2>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Items Subtotal */}
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Subtotal ({cart.length} items)</span>
                                        <span className="font-medium text-gray-900">{formatCurrency(getCartTotal())}</span>
                                    </div>

                                    {/* Shipping by Seller */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 flex items-center gap-1">
                                                <Truck className="w-4 h-4" />
                                                Shipping
                                            </span>
                                            <span className={`font-medium ${calculatingShipping ? 'text-gray-400 animate-pulse' : 'text-emerald-600'}`}>
                                                {calculatingShipping ? 'Calculating...' : formatCurrency(getTotalShipping())}
                                            </span>
                                        </div>
                                        {!calculatingShipping && Object.keys(shippingEstimates).length > 1 && (
                                            <div className="text-xs text-gray-500 space-y-1 pl-5">
                                                {Object.entries(getItemsByManufacturer()).map(([mfId]) => (
                                                    shippingEstimates[mfId]?.selected && (
                                                        <div key={mfId} className="flex justify-between">
                                                            <span className="truncate max-w-[120px]">{manufacturerInfo[mfId]?.name || 'Seller'}</span>
                                                            <span>{formatCurrency(shippingEstimates[mfId].selected.rate)}</span>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* GST Inclusive Note */}
                                    <p className="text-xs text-gray-400 text-center">
                                        All prices are inclusive of GST
                                    </p>

                                    {/* Divider */}
                                    <div className="border-t border-dashed border-gray-200 my-2"></div>

                                    {/* Payment Options */}
                                    <div className="space-y-3 pt-2 pb-4">
                                        <h3 className="text-sm font-semibold text-gray-900">Payment Options</h3>

                                        {/* Full Payment */}
                                        <label className={`block p-3 border rounded-xl cursor-pointer transition-all ${paymentOption === 'full' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="paymentOption"
                                                    value="full"
                                                    checked={paymentOption === 'full'}
                                                    onChange={() => setPaymentOption('full')}
                                                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 bg-white border-gray-300"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex justify-between font-medium text-sm text-gray-900">
                                                        <span>Full Payment</span>
                                                        <span>{formatCurrency(getFullAmount())}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5">Pay 100% + Shipping now</p>
                                                </div>
                                            </div>
                                        </label>

                                        {/* Advance Payment -> Rebranded to Pay Shipping Only */}
                                        <label className={`block p-3 border rounded-xl cursor-pointer transition-all ${paymentOption === 'advance' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="paymentOption"
                                                    value="advance"
                                                    checked={paymentOption === 'advance'}
                                                    onChange={() => setPaymentOption('advance')}
                                                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 bg-white border-gray-300"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex justify-between font-medium text-sm text-gray-900">
                                                        <span>Pay Shipping Only (COD)</span>
                                                        <span>{formatCurrency(getAdvanceAmount())}</span>
                                                    </div>
                                                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                                                        Pay ONLY shipping now. Pay {formatCurrency(getRemainingAmount())} (Product Value) on delivery.
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Grand Total */}
                                    <div className="space-y-2 pb-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-bold text-gray-900">
                                                {paymentOption === 'advance' ? 'Shipping Payable Now' : 'Payable Now'}
                                            </span>
                                            <span className="text-xl font-bold text-emerald-600">
                                                {formatCurrency(getPayableAmount())}
                                            </span>
                                        </div>
                                        {paymentOption === 'advance' && (
                                            <div className="flex justify-between items-center pt-1 border-t border-dashed border-gray-200">
                                                <span className="text-sm font-medium text-gray-500">Pay on Delivery (Product Value)</span>
                                                <span className="text-sm font-bold text-gray-700">{formatCurrency(getRemainingAmount())}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pay Button */}
                                    <button
                                        onClick={handlePlaceOrder}
                                        disabled={placingOrder || cart.length === 0 || calculatingShipping || !allSellersMeetMinimum()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                                    >
                                        {placingOrder ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <CreditCard className="w-5 h-5" />
                                                {paymentOption === 'advance' ? 'Pay Shipping to Confirm Order' : 'Pay Now'}
                                            </>
                                        )}
                                    </button>

                                    {/* Trust Badges - Enhanced */}
                                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                                        <div className="flex flex-col items-center text-center gap-1">
                                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-1">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700">100% Secure</span>
                                            <span className="text-[9px] text-gray-400">Payment Protection</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center gap-1">
                                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-1">
                                                <Building className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700">Verified Sellers</span>
                                            <span className="text-[9px] text-gray-400">Direct from Factory</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center gap-1">
                                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-1">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700">GST Invoice</span>
                                            <span className="text-[9px] text-gray-400">Available on Request</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Sticky Bottom Checkout Bar - Enhanced */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
                    {/* Gradient Shadow */}
                    <div className="absolute inset-x-0 -top-4 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>

                    <div className="bg-white border-t border-gray-100 px-4 py-3 safe-area-inset-bottom">
                        <div className="flex items-center gap-3">
                            {/* Total Section */}
                            <div className="flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-bold text-gray-900">
                                        {formatCurrency(getPayableAmount())}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                                    <Shield className="w-2.5 h-2.5" />
                                    {paymentOption === 'advance'
                                        ? `Shipping Only (Rest on Delivery)`
                                        : 'Full Payment'}
                                </p>
                            </div>

                            {/* Pay Button */}
                            <button
                                onClick={handlePlaceOrder}
                                disabled={placingOrder || cart.length === 0 || calculatingShipping || !allSellersMeetMinimum()}
                                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
                            >
                                {placingOrder ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : calculatingShipping ? (
                                    <span className="text-sm">Loading...</span>
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5" />
                                        <span>{paymentOption === 'advance' ? 'Confirm (COD)' : 'Pay Full'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}
