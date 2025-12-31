import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount)
}

export function generateOrderNumber(): string {
    return `D2B-${Date.now().toString(36).toUpperCase()}`
}

export function calculateDisplayPrice(basePrice: number, markupPercentage: number): number {
    return Math.round(basePrice * (1 + markupPercentage / 100))
}

export function calculateMargin(displayPrice: number, basePrice: number): number {
    return displayPrice - basePrice
}

export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export function formatAddress(address: any): string {
    if (!address) return 'N/A'
    return `${address.address}, ${address.city}, ${address.state} - ${address.pincode}`
}
