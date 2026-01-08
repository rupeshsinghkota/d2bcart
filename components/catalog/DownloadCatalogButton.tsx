'use client'

import { useState } from 'react'
import { Download, FileText, Lock } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useStore } from '@/lib/store'

interface DownloadCatalogButtonProps {
    categoryId: string
    categoryName?: string // Optional for clearer filename if needed client-side, though API handles it
    source?: 'category' | 'product'
    className?: string
    variant?: 'primary' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
}

export default function DownloadCatalogButton({
    categoryId,
    categoryName,
    source = 'product',
    className = '',
    variant = 'primary',
    size = 'md'
}: DownloadCatalogButtonProps) {
    const router = useRouter()
    const pathname = usePathname()
    const user = useStore((state) => state.user)
    const [downloading, setDownloading] = useState(false)

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!user) {
            toast('Please login to download price lists', {
                icon: '🔒',
                duration: 4000
            })
            // Redirect to login with return URL
            const returnUrl = encodeURIComponent(pathname)
            router.push(`/login?returnUrl=${returnUrl}`)
            return
        }

        setDownloading(true)
        const toastId = toast.loading('Generating catalog...')

        try {
            const response = await fetch(`/api/catalog/${categoryId}/download`)

            if (response.status === 401) {
                toast.error('Session expired. Please login again.', { id: toastId })
                return
            }

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Download failed')
            }

            // Create blob and download link
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.style.display = 'none'
            a.href = url
            // Filename from header or fallback
            // Content-Disposition: attachment; filename="Category_Catalog.pdf"
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = 'Catalog.pdf'
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/)
                if (match && match[1]) filename = match[1]
            } else if (categoryName) {
                filename = `${categoryName}_Catalog.pdf`
            }

            a.download = filename
            document.body.appendChild(a)
            a.click()

            // Cleanup
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success('Catalog downloaded!', { id: toastId })

            // Post-download toast for engagement
            setTimeout(() => {
                toast('💡 Tip: Check out related bundles for bulk discounts!', {
                    icon: '📦',
                    duration: 5000
                })
            }, 1500)

        } catch (error: any) {
            console.error('Download error:', error)
            toast.error(error.message || 'Failed to download catalog', { id: toastId })
        } finally {
            setDownloading(false)
        }
    }

    // Styles
    const baseStyles = "inline-flex items-center justify-center gap-2 font-medium transition-all disabled:opacity-50 disabled:cursor-wait"

    // Variant styles
    const variants = {
        primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg",
        outline: "border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50",
        ghost: "text-emerald-600 hover:bg-emerald-50"
    }

    // Size styles
    const sizes = {
        sm: "text-xs px-3 py-1.5 rounded-lg",
        md: "text-sm px-4 py-2 rounded-xl",
        lg: "text-base px-6 py-3 rounded-xl"
    }

    return (
        <button
            onClick={handleDownload}
            disabled={downloading}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            title={user ? "Download Wholesale Price List" : "Login to Download Price List"}
        >
            {downloading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                user ? <FileText className="w-4 h-4" /> : <Lock className="w-4 h-4" />
            )}
            <span>
                {downloading ? 'Generating...' : (user ? 'Download Catalog' : 'Login to Download')}
            </span>
        </button>
    )
}
