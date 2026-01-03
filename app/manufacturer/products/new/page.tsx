'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Category } from '@/types'
import { formatCurrency, calculateDisplayPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, Package, Info } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import VariationManager from '@/components/product/VariationManager'

interface Variation {
    id: string
    name: string
    sku: string
    price: string
    stock: string
    moq: string
}

export default function NewProductPage() {
    const router = useRouter()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
    const [images, setImages] = useState<string[]>([])
    const [productType, setProductType] = useState<'simple' | 'variable'>('simple')
    const [variations, setVariations] = useState<Variation[]>([])

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        base_price: '',
        moq: '1',
        stock: '100',
        category_id: '',
        weight: '0.5',
        length: '10',
        breadth: '10',
        height: '10',
        hsn_code: '',
        tax_rate: '18'
    })

    useEffect(() => {
        fetchCategories()
    }, [])

    const fetchCategories = async () => {
        // 1. Fetch Manufacturer's Subscribed Categories
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch('/api/manufacturer/categories', {
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        })
        const { categories: subscribedIds, error } = await res.json()

        if (error || !subscribedIds || subscribedIds.length === 0) {
            toast.error("You haven't selected any categories yet. Please go to your Profile settings.")
            setTimeout(() => router.push('/manufacturer/profile'), 2000)
            return
        }

        // 2. Fetch ALL Categories to build hierarchy
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name')

        const allCategories = (data || []) as Category[]

        if (allCategories) {
            // Build Map for Lookup
            const catMap = new Map(allCategories.map(c => [c.id, c]))

            // Filter and Build Paths
            const filtered = allCategories
                .filter(c => subscribedIds.includes(c.id))
                .map(c => {
                    let path = c.name
                    let current = c
                    let depth = 0
                    while (current.parent_id && depth < 5) {
                        const parent = catMap.get(current.parent_id)
                        if (parent) {
                            path = `${parent.name} > ${path}`
                            current = parent
                        } else {
                            break
                        }
                        depth++
                    }
                    return { ...c, name: path } // Overwrite name for display
                })
                .sort((a, b) => a.name.localeCompare(b.name))

            setCategories(filtered)
        }
    }

    const handleCategoryChange = (categoryId: string) => {
        const category = categories.find(c => c.id === categoryId)
        setSelectedCategory(category || null)
        setFormData(prev => ({ ...prev, category_id: categoryId }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')
            const userId = (user as any).id

            // Calculate display price and margin
            let basePrice = parseFloat(formData.base_price) || 0
            let stock = parseInt(formData.stock) || 0
            const markupPercentage = selectedCategory?.markup_percentage || 15

            // For variable products, calculate price and stock from variations
            if (productType === 'variable' && variations.length > 0) {
                // Price = minimum variation price
                const variationPrices = variations.map(v => parseFloat(v.price) || 0).filter(p => p > 0)
                if (variationPrices.length > 0) {
                    basePrice = Math.min(...variationPrices)
                }
                // Stock = sum of all variation stocks
                stock = variations.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
            }

            const displayPrice = calculateDisplayPrice(basePrice, markupPercentage)
            const margin = displayPrice - basePrice

            // Generate SKU for parent
            const parentSku = `${formData.name.substring(0, 30).replace(/\s+/g, '-').toUpperCase()}-${Date.now()}`

            // Create parent product
            const { data: parentProduct, error: parentError } = await (supabase.from('products') as any).insert({
                manufacturer_id: userId,
                category_id: formData.category_id,
                name: formData.name,
                description: formData.description,
                base_price: basePrice,
                display_price: displayPrice,
                your_margin: margin,
                moq: parseInt(formData.moq),
                stock: stock,
                images: images,
                is_active: true,
                sku: parentSku,
                type: productType,
                weight: parseFloat(formData.weight) || 0.5,
                length: parseFloat(formData.length) || 10,
                breadth: parseFloat(formData.breadth) || 10,
                height: parseFloat(formData.height) || 10,
                hsn_code: formData.hsn_code,
                tax_rate: parseFloat(formData.tax_rate) || 0
            }).select().single()

            if (parentError) throw parentError

            // Create variations if variable product
            if (productType === 'variable' && variations.length > 0 && parentProduct) {
                const variationInserts = variations.map(v => {
                    const varPrice = parseFloat(v.price) || basePrice
                    const varDisplayPrice = calculateDisplayPrice(varPrice, markupPercentage)
                    return {
                        manufacturer_id: userId,
                        category_id: formData.category_id,
                        name: `${formData.name} - ${v.name}`,
                        description: formData.description,
                        base_price: varPrice,
                        display_price: varDisplayPrice,
                        your_margin: varDisplayPrice - varPrice,
                        moq: parseInt(formData.moq),
                        stock: parseInt(v.stock) || 1000,
                        images: images, // Inherit parent images
                        is_active: true,
                        sku: v.sku,
                        type: 'variation',
                        parent_id: parentProduct.id,
                        weight: parseFloat(formData.weight) || 0.5,
                        length: parseFloat(formData.length) || 10,
                        breadth: parseFloat(formData.breadth) || 10,
                        height: parseFloat(formData.height) || 10,
                        hsn_code: formData.hsn_code,
                        tax_rate: parseFloat(formData.tax_rate) || 0
                    }
                })

                const { error: varError } = await (supabase.from('products') as any).insert(variationInserts)
                if (varError) {
                    console.error('Variation insert error:', varError)
                    toast.error(`Product created but some variations failed: ${varError.message}`)
                }
            }

            const varCount = productType === 'variable' ? ` with ${variations.length} variations` : ''
            toast.success(`Product added successfully${varCount}!`)
            router.push('/manufacturer/products')
        } catch (error: any) {
            toast.error(error.message || 'Failed to add product')
        } finally {
            setLoading(false)
        }
    }

    const updateForm = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // Preview pricing
    const basePrice = parseFloat(formData.base_price) || 0
    const markupPercentage = selectedCategory?.markup_percentage || 0
    const displayPrice = calculateDisplayPrice(basePrice, markupPercentage)
    const margin = displayPrice - basePrice

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/manufacturer"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
                    <p className="text-gray-600">List your product for retailers to discover</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4">Product Information</h2>

                        <div className="space-y-4">
                            {/* Product Type Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Product Type *
                                </label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all ${productType === 'simple' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="productType"
                                            value="simple"
                                            checked={productType === 'simple'}
                                            onChange={() => setProductType('simple')}
                                            className="hidden"
                                        />
                                        <div className="text-center">
                                            <Package className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                                            <div className="font-medium">Simple Product</div>
                                            <div className="text-xs text-gray-500">Single item, no variations</div>
                                        </div>
                                    </label>
                                    <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all ${productType === 'variable' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="productType"
                                            value="variable"
                                            checked={productType === 'variable'}
                                            onChange={() => setProductType('variable')}
                                            className="hidden"
                                        />
                                        <div className="text-center">
                                            <div className="w-6 h-6 mx-auto mb-2 flex">
                                                <Package className="w-4 h-4 text-purple-600" />
                                                <Package className="w-4 h-4 text-purple-400 -ml-1" />
                                            </div>
                                            <div className="font-medium">Variable Product</div>
                                            <div className="text-xs text-gray-500">Multiple models/sizes/colors</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Product Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => updateForm('name', e.target.value)}
                                    className="input"
                                    placeholder="Enter product name"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => updateForm('description', e.target.value)}
                                    className="input min-h-[100px]"
                                    placeholder="Describe your product"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Category *
                                </label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => handleCategoryChange(e.target.value)}
                                    className="input"
                                    required
                                >
                                    <option value="">Select a category</option>
                                    {categories.map(cat => {
                                        // Find parent names for display
                                        // Note: We need the full list to do this efficiently. 
                                        // Since 'categories' state currently ONLY holds filtered items, we might miss parents if they aren't selected.
                                        // However, showing just the name is often ambiguous.
                                        // Let's rely on the name for now, or if we kept 'allCategories' we could build paths.
                                        // Given the constraints, I'll stick to name, but add a TODO or try to show parent if available in the object (if I fetched it properly).
                                        // Actually, I can join `parent_id` but that requires looking up.
                                        // Let's just output the name for now, but assume the user selects LEAF nodes usually.
                                        return (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} (+{cat.markup_percentage}% platform fee)
                                            </option>
                                        )
                                    })}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        HSN Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.hsn_code}
                                        onChange={(e) => updateForm('hsn_code', e.target.value)}
                                        className="input"
                                        placeholder="Enter HSN Code"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        GST Rate (%) *
                                    </label>
                                    <select
                                        value={formData.tax_rate}
                                        onChange={(e) => updateForm('tax_rate', e.target.value)}
                                        className="input"
                                        required
                                    >
                                        <option value="0">0%</option>
                                        <option value="5">5%</option>
                                        <option value="12">12%</option>
                                        <option value="18">18%</option>
                                        <option value="28">28%</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4">Pricing</h2>

                        <div className="space-y-4">
                            {/* Show price input only for simple products */}
                            {productType === 'simple' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Your Price (per unit) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                            <input
                                                type="number"
                                                value={formData.base_price}
                                                onChange={(e) => updateForm('base_price', e.target.value)}
                                                className="input pl-8"
                                                placeholder="0"
                                                min="1"
                                                required
                                            />
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            This is the amount you'll receive per unit sold
                                        </p>
                                    </div>

                                    {/* Price Preview */}
                                    {basePrice > 0 && selectedCategory && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                <div className="space-y-2 flex-1">
                                                    <p className="text-sm text-emerald-800">
                                                        Platform adds <strong>{markupPercentage}%</strong> for {selectedCategory.name} category
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-emerald-200">
                                                        <div>
                                                            <div className="text-xs text-emerald-600">Your Price</div>
                                                            <div className="font-bold text-emerald-800">{formatCurrency(basePrice)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-emerald-600">Listed Price</div>
                                                            <div className="font-bold text-emerald-800">{formatCurrency(displayPrice)}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-emerald-600">Platform Fee</div>
                                                            <div className="font-bold text-emerald-800">{formatCurrency(margin)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm text-purple-800 font-medium">
                                                Variable Product Pricing
                                            </p>
                                            <p className="text-sm text-purple-600 mt-1">
                                                Set prices individually for each variation below. The lowest variation price will be shown as the starting price.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Minimum Order Qty *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.moq}
                                        onChange={(e) => updateForm('moq', e.target.value)}
                                        className="input"
                                        min="1"
                                        required
                                    />
                                </div>
                                {productType === 'simple' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Available Stock
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.stock}
                                            onChange={(e) => updateForm('stock', e.target.value)}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Images */}
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4">Product Images</h2>
                        <ImageUpload
                            images={images}
                            onImagesChange={setImages}
                            maxImages={5}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            First image will be used as the main product image
                        </p>
                    </div>

                    {/* Variations Section - Only for Variable Products */}
                    {productType === 'variable' && (
                        <VariationManager
                            variations={variations}
                            onVariationsChange={setVariations}
                            parentName={formData.name}
                            parentPrice={formData.base_price}
                            parentStock={formData.stock}
                            parentMoq={formData.moq}
                        />
                    )}

                    {/* Submit */}
                    <div className="flex gap-4">
                        <Link href="/manufacturer" className="flex-1 btn-secondary text-center">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 btn-primary flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Package className="w-5 h-5" />
                                    Add Product
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
