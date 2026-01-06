'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseProductCSV, generateTemplate, CSVProduct } from '@/lib/csv-parser'
import { ArrowLeft, Upload, Download, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Helper to download external image and upload to Supabase Storage
async function uploadImageToStorage(externalUrl: string): Promise<string | null> {
    try {
        // Fetch the image from external URL
        const response = await fetch(externalUrl)
        if (!response.ok) return null

        const blob = await response.blob()

        // Generate unique filename
        const ext = externalUrl.split('.').pop()?.split('?')[0] || 'jpg'
        const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, blob, {
                contentType: blob.type || 'image/jpeg',
                upsert: false
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return null
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(fileName)

        return publicUrl
    } catch (error) {
        console.error('Image download/upload failed:', externalUrl, error)
        return null
    }
}

// Process multiple images with fallback to original URL if upload fails
async function processImages(urls: string[]): Promise<string[]> {
    const results: string[] = []
    for (const url of urls) {
        if (!url) continue
        const storedUrl = await uploadImageToStorage(url)
        results.push(storedUrl || url) // Fallback to original if upload fails
    }
    return results
}

export default function BulkUploadPage() {
    const router = useRouter()
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<CSVProduct[]>([])
    const [errors, setErrors] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [successCount, setSuccessCount] = useState(0)
    const [progress, setProgress] = useState({ current: 0, total: 0, name: '' })

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
            toast.error('Please upload a valid CSV file')
            return
        }

        setFile(selectedFile)
        setErrors([])
        setParsedData([])
        setSuccessCount(0) // Reset success count

        const result = await parseProductCSV(selectedFile)

        if (result.errors.length > 0) {
            setErrors(result.errors)
            if (result.data.length === 0) {
                toast.error('Failed to parse file')
                return
            }
            toast('Some rows have errors', { icon: '⚠️' })
        }

        setParsedData(result.data)
    }

    const handleUpload = async () => {
        if (parsedData.length === 0) return

        setUploading(true)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            toast.error('Please login')
            setUploading(false)
            return
        }

        // Fetch category map to convert slug/name to ID
        const { data: categories } = await (supabase.from('categories').select('id, slug, name, parent_id, markup_percentage')) as { data: any[] | null }

        // Helper to resolve category from strings like "Electronics > Mobile Accessories > Cases & Covers"
        const resolveCategoryId = (catString: string) => {
            if (!catString) return null

            // Take the last category if multiple are provided (e.g. "Clothing, Clothing > T-Shirts")
            const parts = catString.split(',').map(p => p.trim()).filter(Boolean)
            const targetedCat = parts[parts.length - 1] || catString

            // Split by hierarchy delimiter and get all parts
            const hierarchy = targetedCat.split('>').map(p => p.trim()).filter(Boolean)

            // Try matching from most specific (leaf) to least specific (root)
            for (let i = hierarchy.length - 1; i >= 0; i--) {
                const partName = hierarchy[i]
                const partSlug = partName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

                // Try slug match
                const bySlug = categories?.find(c => c.slug === partSlug)
                if (bySlug) {
                    console.log(`[CATEGORY] Matched '${partName}' -> ${bySlug.name} (${bySlug.id})`)
                    return bySlug.id
                }

                // Try name match (case insensitive, partial)
                const byName = categories?.find(c =>
                    c.name.toLowerCase() === partName.toLowerCase() ||
                    c.name.toLowerCase().includes(partName.toLowerCase()) ||
                    partName.toLowerCase().includes(c.name.toLowerCase())
                )
                if (byName) {
                    console.log(`[CATEGORY] Matched '${partName}' -> ${byName.name} (${byName.id})`)
                    return byName.id
                }
            }

            console.warn(`[CATEGORY] No match found for: ${catString}`)
            return null
        }

        const categoryMap = new Map(categories?.map(c => [c.id, c]))

        let success = 0
        let skipped = 0
        const uploadErrors: string[] = []
        const skuToIdMap = new Map<string, string>()

        // Helper for pricing
        const getPriceDetails = (basePrice: number, catString: string) => {
            const categoryId = resolveCategoryId(catString)
            const category = categoryId ? categoryMap.get(categoryId) : null
            const markup = category?.markup_percentage || 15
            const displayPrice = Math.ceil(basePrice * (1 + markup / 100))
            const margin = displayPrice - basePrice
            return { displayPrice, margin, categoryId }
        }

        try {
            // Fetch existing SKUs to skip already-imported products (resumable import)
            const { data: existingProducts } = await (supabase
                .from('products')
                .select('sku, id, category_id, images')
                .eq('manufacturer_id', user.id) as any)

            const existingSkuMap = new Map<string, { id: string, categoryId: string | null, images: string[] }>()
            existingProducts?.forEach((p: any) => {
                if (p.sku) {
                    existingSkuMap.set(p.sku, {
                        id: p.id,
                        categoryId: p.category_id,
                        images: p.images || []
                    })
                }
            })

            // PASS 1: Create Main Products (Simple and Variable)
            const mainProducts = parsedData.filter(p => p.type !== 'variation')
            const variations = parsedData.filter(p => p.type === 'variation')
            const totalProducts = mainProducts.length + variations.length
            let currentIndex = 0

            console.log(`[IMPORT] Starting Pass 1: ${mainProducts.length} main products to process`)
            setProgress({ current: 0, total: totalProducts, name: 'Starting...' })

            // Map to store parent details for inheritance: SKU -> { id, categoryId, images }
            const parentDetails = new Map<string, { id: string, categoryId: string | null, images: string[] }>()

            for (const row of mainProducts) {
                currentIndex++
                setProgress({ current: currentIndex, total: totalProducts, name: row.name })
                // Skip if already imported
                if (row.sku && existingSkuMap.has(row.sku)) {
                    const existing = existingSkuMap.get(row.sku)!
                    parentDetails.set(row.sku, existing)
                    skuToIdMap.set(row.sku, existing.id)
                    skipped++
                    continue
                }

                const basePrice = parseFloat(row.base_price) || 0
                const { displayPrice, margin, categoryId } = getPriceDetails(basePrice, row.category_slug)

                if (!categoryId && row.type !== 'variation') {
                    console.error(`[IMPORT ERROR] Category not found: '${row.category_slug}' for product '${row.name}'`)
                    uploadErrors.push(`Category '${row.category_slug}' not found for product '${row.name}'`)
                    continue
                }

                console.log(`[IMPORT] Processing: ${row.name} (${row.sku || 'no-sku'})`)

                // Handle images: split by comma and trim, then upload to storage
                const rawImages = row.image_url
                    ? row.image_url.split(',').map(img => img.trim()).filter(Boolean)
                    : []
                const images = await processImages(rawImages)

                const { data: mainProduct, error } = await (supabase.from('products') as any).insert({
                    manufacturer_id: user.id,
                    category_id: categoryId,
                    name: row.name,
                    description: row.description,
                    base_price: basePrice,
                    display_price: displayPrice,
                    your_margin: margin,
                    moq: parseInt(row.moq),
                    stock: parseInt(row.stock),
                    images: images,
                    is_active: true,
                    sku: row.sku,
                    type: row.type || 'simple',
                    weight: parseFloat(row.weight || '0'),
                    length: parseFloat(row.length || '0'),
                    breadth: parseFloat(row.breadth || '0'),
                    height: parseFloat(row.height || '0'),
                    hsn_code: row.hsn_code,
                    tax_rate: 18 // GST included in price
                }).select().single()

                if (error) {
                    console.error(`[INSERT FAILED] ${row.name}:`, error.message)
                    uploadErrors.push(`Failed to add '${row.name}': ${error.message}`)
                } else {
                    console.log(`[INSERT SUCCESS] ${row.name} -> ID: ${mainProduct?.id}`)
                    success++
                    if (mainProduct && mainProduct.sku) {
                        skuToIdMap.set(mainProduct.sku, mainProduct.id)
                        parentDetails.set(mainProduct.sku, {
                            id: mainProduct.id,
                            categoryId: categoryId,
                            images: images
                        })
                    }
                }
            }

            // PASS 2: Create Variations
            console.log(`[IMPORT] Starting Pass 2: ${variations.length} variations to process`)

            for (const row of variations) {
                currentIndex++
                setProgress({ current: currentIndex, total: totalProducts, name: row.name })

                // Skip if already imported
                if (row.sku && existingSkuMap.has(row.sku)) {
                    skipped++
                    continue
                }

                const parentSku = row.parent_sku || ''
                const parentData = parentDetails.get(parentSku)

                if (!parentData) {
                    uploadErrors.push(`Parent product with SKU '${parentSku}' not found for variation '${row.name}'`)
                    continue
                }

                const basePrice = parseFloat(row.base_price) || 0
                // Use variation's category if provided, otherwise inherit from parent
                const { displayPrice, margin, categoryId } = getPriceDetails(basePrice, row.category_slug || '')
                const finalCategoryId = categoryId || parentData.categoryId

                // Use variation's images if provided, otherwise inherit from parent (already stored)
                const rowImages = row.image_url
                    ? row.image_url.split(',').map(img => img.trim()).filter(Boolean)
                    : []
                // If variation has its own images, upload them; otherwise use parent's already-stored images
                const finalImages = rowImages.length > 0 ? await processImages(rowImages) : parentData.images

                const { error } = await (supabase.from('products') as any).insert({
                    manufacturer_id: user.id,
                    category_id: finalCategoryId,
                    name: row.name,
                    description: row.description,
                    base_price: basePrice,
                    display_price: displayPrice,
                    your_margin: margin,
                    moq: parseInt(row.moq),
                    stock: parseInt(row.stock),
                    images: finalImages,
                    is_active: true,
                    sku: row.sku || null,
                    parent_id: parentData.id,
                    weight: parseFloat(row.weight || '0.5'),
                    length: parseFloat(row.length || '10'),
                    breadth: parseFloat(row.breadth || '10'),
                    height: parseFloat(row.height || '10'),
                    hsn_code: row.hsn_code,
                    tax_rate: 18 // GST included in price
                })

                if (error) {
                    uploadErrors.push(`Failed to add variation '${row.name}': ${error.message}`)
                } else {
                    success++
                }
            }
        } catch (err: any) {
            uploadErrors.push(`Unexpected error: ${err.message}`)
        }

        setUploading(false)
        setSuccessCount(success)

        if (uploadErrors.length > 0) {
            setErrors(prev => [...prev, ...uploadErrors])
            toast.error(`Completed with ${uploadErrors.length} errors`)
        } else {
            const skipMsg = skipped > 0 ? ` (${skipped} already existed)` : ''
            toast.success(`Uploaded ${success} products${skipMsg}!`)
            setTimeout(() => router.push('/wholesaler/products'), 2000)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/wholesaler/products"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Products
                    </Link>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Bulk Product Import</h1>
                            <p className="text-gray-600">Import products from WooCommerce CSV or our custom format</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={generateTemplate}
                                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Download Template
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-4 gap-8">
                    {/* Upload Section */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <Upload className="w-4 h-4 text-emerald-600" />
                                1. Upload CSV
                            </h3>
                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-200 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                                    <FileText className="w-10 h-10 text-emerald-500 mb-3" />
                                    <p className="text-sm font-medium text-gray-700">
                                        {file ? file.name : 'Choose CSV File'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">WooCommerce CSV format supported</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>

                        {/* Progress Display */}
                        {uploading && progress.total > 0 && (
                            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Importing Products...
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-blue-700">
                                        <span>Progress</span>
                                        <span className="font-bold">{progress.current} / {progress.total}</span>
                                    </div>
                                    <div className="w-full bg-blue-100 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-blue-600 truncate" title={progress.name}>
                                        {progress.name}
                                    </p>
                                </div>
                            </div>
                        )}

                        {errors.length > 0 && (
                            <div className="bg-red-50 rounded-xl p-5 border border-red-100">
                                <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    Issues Found ({errors.length})
                                </h3>
                                <ul className="text-xs text-red-600 space-y-2 max-h-60 overflow-y-auto list-disc pl-4">
                                    {errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {successCount > 0 && (
                            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
                                <h3 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    Success!
                                </h3>
                                <p className="text-xs text-emerald-700">
                                    Imported {successCount} items successfully.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Preview Section */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        Import Preview
                                    </h3>
                                    <p className="text-xs text-gray-500">{parsedData.length} total rows detected</p>
                                </div>
                                {parsedData.length > 0 && (
                                    <button
                                        onClick={handleUpload}
                                        disabled={uploading || successCount > 0}
                                        className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                Start Import
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {parsedData.length === 0 ? (
                                <div className="p-16 text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                        <FileText className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h4 className="text-gray-900 font-medium mb-1">No file selected</h4>
                                    <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                        Upload a WooCommerce CSV file to see a preview of your products before importing.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-4">Type</th>
                                                <th className="px-4 py-4">SKU</th>
                                                <th className="px-4 py-4">Product Name</th>
                                                <th className="px-4 py-4">Price</th>
                                                <th className="px-4 py-4">Stock</th>
                                                <th className="px-4 py-4">MOQ</th>
                                                <th className="px-4 py-4">Category</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y border-t border-gray-100">
                                            {parsedData.slice(0, 20).map((row, i) => (
                                                <tr key={i} className={`hover:bg-gray-50 transition-colors ${row.type === 'variation' ? 'bg-gray-50/30' : ''}`}>
                                                    <td className="px-4 py-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${row.type === 'variable' ? 'bg-purple-100 text-purple-700' :
                                                            row.type === 'variation' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                            {row.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-500 font-mono">{row.sku || '-'}</td>
                                                    <td className="px-4 py-4 font-medium text-gray-900">
                                                        <div className="flex flex-col">
                                                            {row.type === 'variation' && <span className="text-[10px] text-gray-400">↳ Parent: {row.parent_sku}</span>}
                                                            {row.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-emerald-700 font-bold">₹{row.base_price || '-'}</td>
                                                    <td className="px-4 py-4 text-gray-600">{row.stock}</td>
                                                    <td className="px-4 py-4 text-gray-600 font-medium">{row.moq}</td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-gray-500 truncate max-w-[100px] block" title={row.category_slug}>
                                                            {row.category_slug}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {parsedData.length > 20 && (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-4 text-center text-gray-500 bg-gray-50/50 italic">
                                                        ...and {parsedData.length - 20} more rows
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
