'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function WhatsAppButton() {
    const pathname = usePathname()
    const [message, setMessage] = useState('')

    // Don't show on Cart page to avoid overlap with Sticky Checkout Bar
    if (pathname === '/cart') return null

    useEffect(() => {
        // Construct message with full URL
        const baseUrl = window.location.origin
        const fullUrl = `${baseUrl}${pathname}`
        const text = `Hi, I need help with this page: ${fullUrl}`
        setMessage(encodeURIComponent(text))
    }, [pathname])

    const handleClick = () => {
        // Track 'Contact' event on Facebook Pixel
        import('@/lib/fpixel').then((fpixel) => {
            fpixel.event('Contact', {
                content_name: 'WhatsApp Support',
                value: 0,
                currency: 'INR'
            })
        })
    }

    return (
        <a
            href={`https://wa.me/919117474683?text=${message}`}
            onClick={handleClick}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-110 hover:shadow-xl md:bottom-6 md:right-6"
            aria-label="Chat on WhatsApp"
        >
            <div className="relative h-8 w-8">
                <Image
                    src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                    alt="WhatsApp"
                    fill
                    className="object-contain invert"
                    style={{ filter: 'brightness(0) invert(1)' }}
                />
            </div>
        </a>
    )
}
