'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseProductCSV, generateTemplate, CSVProduct } from '@/lib/csv-parser'
import { ArrowLeft, Upload, Download, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BulkUploadPage() {
    const router = useRouter()
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<CSVProduct[]>([])
    const [errors, setErrors] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [successCount, setSuccessCount] = useState(0)

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

        // Fetch category map to convert slug to ID
        const { data: categories } = await supabase.from('categories').select('id, slug')
        const categoryMap = new Map(categories?.map(c => [c.slug, c.id]))

        let success = 0
        const uploadErrors: string[] = []

        for (const row of parsedData) {
            const categoryId = categoryMap.get(row.category_slug)

            if (!categoryId) {
                uploadErrors.push(`Category '${row.category_slug}' not found for product '${row.name}'`)
                continue
            }

            const { error } = await supabase.from('products').insert({
                manufacturer_id: user.id,
                category_id: categoryId,
                name: row.name,
                description: row.description,
                base_price: parseFloat(row.base_price),
                display_price: parseFloat(row.base_price) * 1.25, // Mock platform markup
                your_margin: parseFloat(row.base_price) * 0.10, // Mock calculation
                moq: parseInt(row.moq),
                stock: parseInt(row.stock),
                images: row.image_url ? [row.image_url] : [],
                is_active: true
            })

            if (error) {
                uploadErrors.push(`Failed to add '${row.name}': ${error.message}`)
            } else {
                success++
            }
        }

        setUploading(false)
        setSuccessCount(success)

        if (uploadErrors.length > 0) {
            setErrors(prev => [...prev, ...uploadErrors])
            toast.error(`Completed with ${uploadErrors.length} errors`)
        } else {
            toast.success(`Successfully uploaded ${success} products!`)
            setTimeout(() => router.push('/manufacturer/products'), 2000)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/manufacturer/products"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Products
                    </Link>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Bulk Product Upload</h1>
                            <p className="text-gray-600">Upload multiple products via CSV</p>
                        </div>
                        <button
                            onClick={generateTemplate}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download Template
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Upload Section */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <h3 className="font-semibold mb-4">1. Select File</h3>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500">
                                        {file ? file.name : 'Click to upload CSV'}
                                    </p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>

                        {errors.length > 0 && (
                            <div className="bg-red-50 rounded-xl p-6 border border-red-100">
                                <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Validation Errors
                                </h3>
                                <ul className="text-sm text-red-600 space-y-1 max-h-48 overflow-y-auto list-disc pl-4">
                                    {errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {successCount > 0 && errors.length === 0 && (
                            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                                <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    Upload Complete
                                </h3>
                                <p className="text-green-700">
                                    Successfully processed {successCount} products. Redirecting...
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Preview Section */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b flex justify-between items-center">
                                <h3 className="font-semibold">
                                    Preview ({parsedData.length} valid rows)
                                </h3>
                                {parsedData.length > 0 && (
                                    <button
                                        onClick={handleUpload}
                                        disabled={uploading || successCount > 0}
                                        className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            'Upload Products'
                                        )}
                                    </button>
                                )}
                            </div>

                            {parsedData.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p>Upload a file to preview data</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-700 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Name</th>
                                                <th className="px-4 py-3">Price</th>
                                                <th className="px-4 py-3">Stock</th>
                                                <th className="px-4 py-3">Category</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {parsedData.slice(0, 10).map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium">{row.name}</td>
                                                    <td className="px-4 py-3">₹{row.base_price}</td>
                                                    <td className="px-4 py-3">{row.stock}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                                                            {row.category_slug}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {parsedData.length > 10 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-3 text-center text-gray-500 bg-gray-50 italic">
                                                        ...and {parsedData.length - 10} more rows
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
