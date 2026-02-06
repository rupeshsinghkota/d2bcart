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
    MapPin,
    MessageCircle,
    AlertTriangle
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
        try {
            if (!isSupabaseConfigured) {
                return
            }
            const { data, error: authError } = await supabase.auth.getUser()

            if (authError) {
                console.error('[Cart] Auth Error:', authError)
                return
            }

            if (data?.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', data.user.id)
                    .single()

                if (profileError) {
                    console.error('[Cart] Profile Fetch Error:', profileError)
                } else {
                    setUser(profile)
                    if ((profile as any)?.pincode) setShippingPincode((profile as any).pincode)
                }
            }
        } catch (err) {
            console.error('[Cart] Unexpected error in checkUser:', err)
        } finally {
            setLoading(false)
        }
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
                    // Combine weight and calculate total volume
                    let totalWeight = 0
                    let totalVolume = 0
                    let maxL = 10, maxB = 10

                    items.forEach(item => {
                        // User Clarification: Weight & Dims are for the "MOQ Pack"
                        const moq = item.product.moq || 1
                        const sets = item.quantity / moq // e.g. 50 units / 10 moq = 5 packs

                        // Weight is for the PACK (MOQ), so multiply by number of PACKS (sets), not units
                        const weightPerSet = item.product.weight || 0.5
                        totalWeight += weightPerSet * sets

                        const l = item.product.length || 10
                        const b = item.product.breadth || 10
                        const h = item.product.height || 10

                        // Track Max Dimensions (of a single pack)
                        maxL = Math.max(maxL, l)
                        maxB = Math.max(maxB, b)

                        // Volume per set * number of sets
                        totalVolume += (l * b * h) * sets
                    })

                    // Calculate Total Declared Value for Insurance Surcharge accuracy
                    const totalValue = items.reduce((sum, item) => sum + (item.product.display_price * item.quantity), 0)

                    // Estimate Package Height based on fixed Base Area (MaxL * MaxB)
                    // This simulates stacking packs on top of each other
                    const calculatedHeight = Math.ceil(totalVolume / (maxL * maxB)) || 10

                    // console.log(`[Shipping Calc] Mfr: ${manufacturerId}, Wt: ${totalWeight}, Vol: ${totalVolume}, Dims: ${maxL}x${maxB}x${calculatedHeight}, Val: ${totalValue}`)

                    const res = await fetch('/api/shiprocket/estimate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            manufacturer_id: manufacturerId,
                            delivery_pincode: shippingPincode,
                            weight: totalWeight,
                            length: maxL,
                            breadth: maxB,
                            height: calculatedHeight,
                            declared_value: totalValue,
                            cod: paymentOption === 'advance' ? 1 : 0
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

    const handleWhatsAppShare = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty")
            return
        }

        // Validate Guest Details if not logged in
        if (!user && (!guestForm.name || !guestForm.phone)) {
            toast.error("Please enter Name and Phone in Shipping Details first")
            return
        }

        let message = `*New Order Request* 🛒%0A%0A`

        // Group items for cleaner message
        const itemsByMfr = getItemsByManufacturer()
        let grandTotal = 0

        Object.entries(itemsByMfr).forEach(([mfId, items]) => {
            const mfrName = manufacturerInfo[mfId]?.name || 'Seller'
            message += `*Seller: ${mfrName}*%0A`

            items.forEach(item => {
                const total = item.product.display_price * item.quantity
                grandTotal += total
                message += `- ${item.product.name} (x${item.quantity}) - ₹${total}%0A`
            })
            message += `%0A`
        })

        message += `*Total Product Value: ₹${grandTotal.toLocaleString()}*%0A`
        message += `(Shipping calculated at actuals)%0A%0A`

        if (user) {
            message += `*Customer Details:*%0A`
            message += `Name: ${user.business_name || user.full_name || 'N/A'}%0A`
            message += `Phone: ${user.phone}%0A`
        } else {
            message += `*Customer Details (Guest):*%0A`
            message += `Name: ${guestForm.name}%0A`
            message += `Phone: ${guestForm.phone}%0A`
            if (guestForm.city) message += `City: ${guestForm.city}%0A`
        }

        // Platform Admin Number (Fallback to a default if env not set)
        const adminPhone = process.env.NEXT_PUBLIC_ADMIN_PHONE || "917557777987"

        window.open(`https://wa.me/${adminPhone}?text=${message}`, '_blank')
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

            // 2. Prepare Cart Payload (Moved BEFORE Order Creation)
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

            const paymentBreakdown = {
                total_product_amount: totalProductAmount,
                total_shipping_amount: totalShippingAmount,
                payable_amount: payableAmount,
                remaining_balance: remainingBalance
            }

            const userAddress = {
                address: currentUser.address,
                city: currentUser.city,
                state: currentUser.state || '',
                pincode: currentUser.pincode
            }

            // 3. Create Razorpay Order with Context
            const orderRes = await fetch('/api/razorpay/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: payableAmount,
                    // Pass Context for Recovery
                    user_id: currentUser.id,
                    cart_payload: cartPayload,
                    payment_breakdown: paymentBreakdown,
                    shipping_address: userAddress
                })
            })

            if (!orderRes.ok) {
                const error = await orderRes.json()
                throw new Error(error.error || 'Failed to create payment order')
            }

            const razorpayOrder = await orderRes.json()


            // Payload preparation (Moved up)


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
                        console.log('[Cart] Verifying Payment. User:', currentUser.id, 'Payload Items:', cartPayload.length)
                        const verifyRes = await fetch('/api/razorpay/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                cart_payload: cartPayload, // Pass the cart data
                                user_id: currentUser.id, // Use currentUser
                                user_address: userAddress,
                                payment_option: paymentOption,
                                payment_breakdown: paymentBreakdown,
                                attribution: (() => {
                                    try {
                                        const saved = localStorage.getItem('d2b_attribution')
                                        return saved ? JSON.parse(saved) : null
                                    } catch (e) {
                                        return null
                                    }
                                })()
                            })
                        })

                        const verifyData = await verifyRes.json()
                        if (verifyData.success) {
                            // Facebook Pixel: Purchase
                            // Fix: Await import and add delay to ensure event fires before navigation
                            try {
                                const fpixel = await import('@/lib/fpixel')
                                fpixel.event('Purchase', {
                                    content_type: 'product',
                                    content_ids: cart.map(item => item.product.id),
                                    value: payableAmount,
                                    currency: 'INR',
                                    num_items: cart.length,
                                    transaction_id: response.razorpay_payment_id,
                                })
                            } catch (e) {
                                console.error('Pixel Error', e)
                            }

                            toast.success('Payment Successful!')
                            clearCart()

                            // Small delay to allow Pixel & GTM to fire
                            setTimeout(() => {
                                router.push('/retailer/orders')
                            }, 1000)
                        } else {
                            toast.error(verifyData.error || 'Payment Verification Failed')
                            console.error('Verification Error', verifyData)
                            setPlacingOrder(false)
                        }

                    } catch (verifyError: any) {
                        console.error('Verification Exception', verifyError)
                        toast.error(verifyError.message || 'Payment verification failed after success')
                        setPlacingOrder(false)
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
        <div className="min-h-screen bg-[#F4F6F8] pb-40 md:pb-16 font-sans selection:bg-emerald-100 selection:text-emerald-900 group/page">
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/50 via-transparent to-transparent opacity-60 z-0"></div>

            {/* Mobile Header - Glassmorphism */}
            <div className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 px-5 py-4 transition-all duration-300 shadow-sm supports-[backdrop-filter]:bg-white/60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-gray-100/80 active:bg-gray-200/80 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-800" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                Cart
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-extrabold">{cart.length}</span>
                            </h1>
                        </div>
                    </div>
                    {cart.length > 0 && (
                        <div className="text-right">
                            <p className="font-bold text-emerald-600 text-lg tracking-tight">{formatCurrency(getCartTotal())}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
                {/* WhatsApp Order Button (Mobile Only) */}
                <div className="md:hidden mb-6">
                    <button
                        onClick={handleWhatsAppShare}
                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-transform"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Order on WhatsApp
                    </button>
                </div>
                {/* Desktop Header - Enhanced */}
                <div className="hidden md:flex md:items-center md:justify-between mb-8 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards">
                    <div>
                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 text-gray-400 hover:text-emerald-600 mb-4 transition-colors text-sm font-medium tracking-wide group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Continue Shopping
                        </Link>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                            Shopping Cart
                            <span className="text-xl font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{cart.length} items</span>
                        </h1>
                    </div>
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
                        <div className="lg:col-span-2 space-y-6">
                            {/* Cart Items - Grouped by Seller */}
                            <div className="space-y-6">
                                {Object.entries(getItemsByManufacturer()).map(([mfId, items]) => {
                                    const sellerTotal = getSellerProductTotal(mfId)
                                    const isBelowMinimum = sellerTotal < MIN_ORDER_PER_SELLER
                                    const shortfall = MIN_ORDER_PER_SELLER - sellerTotal

                                    return (
                                        <div key={mfId} className={`bg-white rounded-[2rem] shadow-xl shadow-emerald-900/5 border ${isBelowMinimum ? 'border-amber-200' : 'border-white'} overflow-hidden transition-all hover:shadow-2xl hover:shadow-emerald-900/10`}>
                                            {/* Seller Header */}
                                            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${isBelowMinimum ? 'bg-amber-100 text-amber-600' : 'bg-white text-emerald-600 ring-1 ring-gray-100'}`}>
                                                        <Store className="w-5 h-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate tracking-tight">
                                                            {manufacturerInfo[mfId]?.name || 'Seller'}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 font-medium">
                                                            {items.length} Product{items.length > 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Subtotal</p>
                                                    <p className={`font-black text-lg ${isBelowMinimum ? 'text-amber-600' : 'text-gray-900'}`}>
                                                        {formatCurrency(sellerTotal)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Minimum Order Warning */}
                                            {isBelowMinimum && (
                                                <div className="bg-amber-50/80 backdrop-blur-sm px-6 py-3 border-b border-amber-100/50 flex items-center gap-3">
                                                    <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                                                        <span className="text-amber-700 text-xs font-bold">!</span>
                                                    </div>
                                                    <p className="text-sm text-amber-900 font-medium">
                                                        Add <span className="font-bold bg-amber-100 px-1.5 py-0.5 rounded text-amber-800 border border-amber-200">{formatCurrency(shortfall)}</span> more to meet minimum
                                                    </p>
                                                </div>
                                            )}

                                            {/* Products List */}
                                            <div className="divide-y divide-gray-50">
                                                {items.map((item) => (
                                                    <div
                                                        key={item.product.id}
                                                        className="p-5 sm:p-6 hover:bg-gray-50/30 transition-colors group"
                                                    >
                                                        <div className="flex gap-4 sm:gap-6">
                                                            {/* Product Image */}
                                                            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-100 rounded-2xl flex-shrink-0 overflow-hidden relative shadow-inner group-hover:shadow-md transition-all">
                                                                {item.product.images?.[0] ? (
                                                                    <Image
                                                                        src={item.product.images[0]}
                                                                        alt={item.product.name}
                                                                        fill
                                                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <Package className="w-8 h-8 text-gray-300" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                                {/* Top Row */}
                                                                <div>
                                                                    <div className="flex justify-between items-start gap-4">
                                                                        <h4 className="font-bold text-gray-900 text-base sm:text-lg leading-snug line-clamp-2">
                                                                            {item.product.name}
                                                                        </h4>
                                                                        <button
                                                                            onClick={() => removeFromCart(item.product.id)}
                                                                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all flex-shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100"
                                                                            title="Remove Item"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>

                                                                    <div className="mt-2 flex items-baseline gap-2">
                                                                        <span className="font-black text-xl text-gray-900">
                                                                            {formatCurrency(item.product.display_price)}
                                                                        </span>
                                                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-md">
                                                                            MOQ: {item.product.moq}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Bottom Row: Qty & Total */}
                                                                <div className="flex items-end justify-between mt-4">
                                                                    {/* Pill Quantity Selector */}
                                                                    <div className="flex items-center bg-white border border-gray-200 rounded-full shadow-sm hover:border-emerald-200 transition-colors h-10">
                                                                        <button
                                                                            onClick={() => updateQuantity(item.product.id, Math.max(item.product.moq, item.quantity - (item.product.moq || 1)))}
                                                                            className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-l-full transition-colors active:scale-90"
                                                                        >
                                                                            <Minus className="w-4 h-4" />
                                                                        </button>
                                                                        <div className="w-10 h-4 border-l border-r border-gray-100 flex items-center justify-center">
                                                                            <span className="text-sm font-bold text-gray-900">{item.quantity}</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => updateQuantity(item.product.id, item.quantity + (item.product.moq || 1))}
                                                                            className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-r-full transition-colors active:scale-90"
                                                                        >
                                                                            <Plus className="w-4 h-4" />
                                                                        </button>
                                                                    </div>

                                                                    {/* Item Total */}
                                                                    <div className="text-right">
                                                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Item Total</p>
                                                                        <p className="font-extrabold text-emerald-600 text-lg leading-none mt-0.5">
                                                                            {formatCurrency(item.product.display_price * item.quantity)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Shipping Section for this Seller */}
                                            <div className="bg-emerald-50/30 px-6 py-4 border-t border-emerald-100/50">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                                                        <div className="p-1.5 bg-emerald-100 rounded-lg">
                                                            <Truck className="w-4 h-4 text-emerald-700" />
                                                        </div>
                                                        <span>Shipping Options</span>
                                                        {shippingEstimates[mfId] && !shippingEstimates[mfId].error && (
                                                            <span className="text-xs font-normal text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-100 shadow-sm">
                                                                {shippingEstimates[mfId].totalWeight}kg
                                                            </span>
                                                        )}
                                                    </div>
                                                    {shippingEstimates[mfId]?.selected && (
                                                        <span className="text-base font-black text-emerald-700">
                                                            {formatCurrency(shippingEstimates[mfId].selected.rate)}
                                                        </span>
                                                    )}
                                                </div>

                                                {calculatingShipping && !shippingEstimates[mfId] ? (
                                                    <div className="flex items-center gap-3 text-sm text-gray-500 py-4 bg-white/50 rounded-xl px-4 animate-pulse">
                                                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                        Fetching best rates...
                                                    </div>
                                                ) : shippingEstimates[mfId]?.error ? (
                                                    <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-red-100">
                                                        <AlertTriangle className="w-4 h-4" />
                                                        {shippingEstimates[mfId].error}
                                                    </div>
                                                ) : shippingEstimates[mfId] ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {shippingEstimates[mfId].options?.map((opt: any, idx: number) => {
                                                            const isSelected = shippingEstimates[mfId].selected?.id === opt.id
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => setCourierForManufacturer(mfId, opt)}
                                                                    className={`relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${isSelected
                                                                        ? 'bg-white border-emerald-500 shadow-md shadow-emerald-900/10 z-10'
                                                                        : 'bg-white/50 border-transparent hover:border-emerald-200 hover:bg-white'
                                                                        }`}
                                                                >
                                                                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                                                                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex justify-between items-start">
                                                                            <span className={`text-sm font-bold truncate pr-2 ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>
                                                                                {opt.courier}
                                                                            </span>
                                                                            <span className="text-sm font-bold text-emerald-700">{formatCurrency(opt.rate)}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                                                                            <Clock className="w-3 h-3" />
                                                                            <span>Est. {opt.etd}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Guest / User Shipping Details */}
                            <div className="bg-white rounded-[2rem] shadow-xl shadow-emerald-900/5 border border-white p-6 sm:p-8">
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
                        </div>

                        {/* Order Summary */}
                        {/* Order Summary & WhatsApp */}
                        <div className="space-y-4">
                            {/* WhatsApp Order Button */}
                            <div className="hidden md:block bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 bg-emerald-50/30">
                                <h3 className="font-bold text-gray-900 mb-1 text-sm">Need Help?</h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    Prefer to order via chat? Send cart to WhatsApp.
                                </p>
                                <button
                                    onClick={handleWhatsAppShare}
                                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm text-sm"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Order on WhatsApp
                                </button>
                            </div>

                            <div className="bg-white rounded-[2rem] shadow-xl shadow-emerald-900/5 border border-white sticky top-24 overflow-hidden ring-1 ring-gray-100">
                                {/* Header */}
                                <div className="bg-gradient-to-br from-emerald-50 via-white to-white px-6 py-5 border-b border-gray-50">
                                    <h2 className="font-black text-xl text-gray-900 tracking-tight">Order Summary</h2>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Items Subtotal */}
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">Subtotal ({cart.length} items)</span>
                                        <span className="font-bold text-gray-900">{formatCurrency(getCartTotal())}</span>
                                    </div>

                                    {/* Shipping by Seller */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500 font-medium flex items-center gap-1.5">
                                                <Truck className="w-4 h-4 text-gray-400" />
                                                Shipping Charges
                                            </span>
                                            <span className={`font-bold ${calculatingShipping ? 'text-gray-400 animate-pulse' : 'text-emerald-700'}`}>
                                                {calculatingShipping ? 'Calculating...' : formatCurrency(getTotalShipping())}
                                            </span>
                                        </div>
                                        {!calculatingShipping && Object.keys(shippingEstimates).length > 1 && (
                                            <div className="space-y-2 pl-2 border-l-2 border-dashed border-gray-100 ml-1.5 py-1">
                                                {Object.entries(getItemsByManufacturer()).map(([mfId]) => (
                                                    shippingEstimates[mfId]?.selected && (
                                                        <div key={mfId} className="flex justify-between text-xs">
                                                            <span className="truncate max-w-[120px] text-gray-400 font-medium">{manufacturerInfo[mfId]?.name || 'Seller'}</span>
                                                            <span className="text-gray-600 font-semibold">{formatCurrency(shippingEstimates[mfId].selected.rate)}</span>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-dashed border-gray-200"></div>

                                    {/* Payment Options */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Method</h3>

                                        {/* Full Payment */}
                                        <label onClick={() => setPaymentOption('full')} className={`block p-4 border rounded-2xl cursor-pointer transition-all group ${paymentOption === 'full' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-200 bg-white'}`}>
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${paymentOption === 'full' ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300 group-hover:border-emerald-400'}`}>
                                                    {paymentOption === 'full' && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between font-bold text-gray-900">
                                                        <span>Full Payment</span>
                                                        <span className="text-emerald-700">{formatCurrency(getFullAmount())}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 font-medium">Pay 100% of product + shipping now</p>
                                                </div>
                                            </div>
                                        </label>

                                        {/* Advance Payment */}
                                        <label onClick={() => setPaymentOption('advance')} className={`block p-4 border rounded-2xl cursor-pointer transition-all group ${paymentOption === 'advance' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-200 bg-white'}`}>
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${paymentOption === 'advance' ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300 group-hover:border-emerald-400'}`}>
                                                    {paymentOption === 'advance' && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between font-bold text-gray-900">
                                                        <span>Ship-only (COD)</span>
                                                        <span className="text-emerald-700">{formatCurrency(getAdvanceAmount())}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 font-medium pb-2">
                                                        Pay shipping now. Rest <strong>{formatCurrency(getRemainingAmount())}</strong> on delivery.
                                                    </p>
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-md">
                                                        <ShieldCheck className="w-3 h-3" />
                                                        Safe Option
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Grand Total */}
                                    <div className="pt-2">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-bold text-gray-600 pb-1">
                                                {paymentOption === 'advance' ? 'Payable Now' : 'Total Amount'}
                                            </span>
                                            <span className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                                                {formatCurrency(getPayableAmount())}
                                            </span>
                                        </div>
                                        {paymentOption === 'advance' && (
                                            <p className="text-right text-xs text-gray-400 font-medium">
                                                + {formatCurrency(getRemainingAmount())} on Delivery
                                            </p>
                                        )}
                                    </div>

                                    {/* Pay Button */}
                                    <button
                                        onClick={handlePlaceOrder}
                                        disabled={placingOrder || cart.length === 0 || calculatingShipping || !allSellersMeetMinimum()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-emerald-600/20"
                                    >
                                        {placingOrder ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                {paymentOption === 'advance' ? 'Pay Shipping & Confirm' : 'Complete Order'}
                                                <ArrowLeft className="w-5 h-5 rotate-180" />
                                            </>
                                        )}
                                    </button>

                                    {/* Trust Badges - Enhanced */}
                                    <div className="grid grid-cols-3 gap-2 pt-2">
                                        <div className="flex flex-col items-center text-center gap-1.5 px-2 py-3 bg-gray-50/50 rounded-xl">
                                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                            <span className="text-[10px] font-bold text-gray-500 leading-tight">Secure Payment</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center gap-1.5 px-2 py-3 bg-gray-50/50 rounded-xl">
                                            <Building className="w-5 h-5 text-emerald-600" />
                                            <span className="text-[10px] font-bold text-gray-500 leading-tight">Verified Sellers</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center gap-1.5 px-2 py-3 bg-gray-50/50 rounded-xl">
                                            <FileText className="w-5 h-5 text-emerald-600" />
                                            <span className="text-[10px] font-bold text-gray-500 leading-tight">GST Invoice</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Sticky Bottom Checkout Bar - Floating Glass Island */
                cart.length > 0 && (
                    <div className="md:hidden fixed bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50">
                        <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_rgb(0,0,0,0.3)] ring-1 ring-white/10"></div>
                        <div className="relative px-5 py-3.5 flex items-center justify-between gap-3 text-white">
                            {/* Total Section */}
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight truncate">
                                    {paymentOption === 'advance' ? 'Pay Only' : 'Total'}
                                </span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black tracking-tight text-white truncate">
                                        {formatCurrency(getPayableAmount())}
                                    </span>
                                </div>
                            </div>

                            {/* Pay Button - Swipe Style */}
                            <button
                                onClick={handlePlaceOrder}
                                disabled={placingOrder || cart.length === 0 || calculatingShipping || !allSellersMeetMinimum()}
                                className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-900 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95"
                            >
                                {placingOrder ? (
                                    <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                                ) : calculatingShipping ? (
                                    <span className="text-xs font-bold whitespace-nowrap">Waiting...</span>
                                ) : (
                                    <>
                                        <span>Complete Order</span>
                                        <div className="bg-gray-900/20 p-1 rounded-full">
                                            <ArrowLeft className="w-3 h-3 rotate-180 text-gray-900" />
                                        </div>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
        </div >
    )
}
