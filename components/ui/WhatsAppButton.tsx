import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface WhatsAppButtonProps {
    phoneNumber?: string
    message?: string
    variant?: 'primary' | 'outline' | 'ghost' | 'link'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    className?: string
    label?: string
    showIcon?: boolean
}

const DEFAULT_NUMBER = '917557777987' // Support Number

export function WhatsAppButton({
    phoneNumber = DEFAULT_NUMBER,
    message = "Hi, I have a query.",
    variant = 'primary',
    size = 'md',
    className,
    label = "Chat on WhatsApp",
    showIcon = true
}: WhatsAppButtonProps) {

    // Clean phone number (remove +, spaces, dashes)
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')

    // Encode message
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`

    const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"

    const variants = {
        primary: "bg-[#25D366] text-white hover:bg-[#128C7E] shadow-sm", // WhatsApp Green
        outline: "border border-[#25D366] text-[#25D366] hover:bg-emerald-50",
        ghost: "hover:bg-emerald-50 text-[#25D366]",
        link: "text-[#25D366] underline-offset-4 hover:underline"
    }

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2",
        lg: "h-12 px-8 text-lg",
        icon: "h-10 w-10"
    }

    return (
        <Link
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(baseStyles, variants[variant], sizes[size], className)}
        >
            {showIcon && <MessageCircle className={cn("w-4 h-4", label ? "mr-2" : "")} />}
            {variant !== 'link' && size !== 'icon' && label}
        </Link>
    )
}
