'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Category } from '@/types'
import { formatCurrency, calculateDisplayPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, Package, Info, Save } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'

export default function EditProductPage() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string

    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
    const [images, setImages] = useState<string[]>([])

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
        height: '10'
    })

    useEffect(() => {
        fetchCategories()
        if (id) {
            fetchProduct()
        }
    }, [id])

    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('*').order('name')
        if (data) setCategories(data)
    }

    const fetchProduct = async () => {
        try {
            const { data: product, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error

            setFormData({
                name: product.name,
                description: product.description || '',
                base_price: product.base_price.toString(),
                moq: product.moq.toString(),
                stock: product.stock.toString(),
                category_id: product.category_id,
                weight: product.weight?.toString() || '0.5',
                length: product.length?.toString() || '10',
                breadth: product.breadth?.toString() || '10',
                height: product.height?.toString() || '10'
            })
            setImages(product.images || [])

            // Set initial category for calculations
            // Categories might be empty if fetched async, so handle in effect or check later
            // Better to rely on categories being fetched.
        } catch (error) {
            console.error('Error fetching product:', error)
            toast.error('Failed to load product')
        } finally {
            setLoading(false)
        }
    }

    // Effect to set selected category once both product data and categories are available
    useEffect(() => {
        if (categories.length > 0 && formData.category_id) {
            const category = categories.find(c => c.id === formData.category_id)
            setSelectedCategory(category || null)
        }
    }, [categories, formData.category_id])


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

            // Calculate display price and margin
            const basePrice = parseFloat(formData.base_price)
            const markupPercentage = selectedCategory?.markup_percentage || 15
            const displayPrice = calculateDisplayPrice(basePrice, markupPercentage)
            const margin = displayPrice - basePrice

            const { error } = await supabase.from('products').update({
                category_id: formData.category_id,
                name: formData.name,
                description: formData.description,
                base_price: basePrice,
                display_price: displayPrice,
                your_margin: margin,
                moq: parseInt(formData.moq),
                stock: parseInt(formData.stock),
                images: images,
                weight: parseFloat(formData.weight) || 0.5,
                length: parseFloat(formData.length) || 10,
                breadth: parseFloat(formData.breadth) || 10,
                height: parseFloat(formData.height) || 10
            }).eq('id', id).eq('manufacturer_id', user.id)

            if (error) throw error

            toast.success('Product updated successfully!')
            router.push('/manufacturer')
        } catch (error: any) {
            toast.error(error.message || 'Failed to update product')
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

    if (loading && !formData.name) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

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
                    <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
                    <p className="text-gray-600">Update your product details and pricing</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4">Product Information</h2>

                        <div className="space-y-4">
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
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name} (+{cat.markup_percentage}% platform fee)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4">Pricing</h2>

                        <div className="space-y-4">
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
                            </div>
                        </div>
                    </div>

                    {/* Shipping Details */}
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h2 className="font-semibold text-lg mb-4">Shipping Details (Used for Rates)</h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.weight}
                                    onChange={(e) => updateForm('weight', e.target.value)}
                                    className="input"
                                    placeholder="0.5"
                                    min="0.01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Length (cm)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={formData.length}
                                    onChange={(e) => updateForm('length', e.target.value)}
                                    className="input"
                                    placeholder="10"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Breadth (cm)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={formData.breadth}
                                    onChange={(e) => updateForm('breadth', e.target.value)}
                                    className="input"
                                    placeholder="10"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={formData.height}
                                    onChange={(e) => updateForm('height', e.target.value)}
                                    className="input"
                                    placeholder="10"
                                    min="1"
                                />
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
                                    <Save className="w-5 h-5" />
                                    Update Product
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
