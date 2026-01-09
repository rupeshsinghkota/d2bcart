
'use client'

import { useEffect, useRef } from 'react'

interface MarketingTimerProps {
    eventType: 'browse_category' | 'browse_product'
    id: string
    delaySeconds?: number // Default should be 300 (5 mins)
}

export function MarketingTimer({ eventType, id, delaySeconds = 300 }: MarketingTimerProps) {
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const hasTriggeredRef = useRef(false)

    useEffect(() => {
        // Reset on ID change (e.g., navigating to different category/product)
        hasTriggeredRef.current = false

        if (timerRef.current) clearTimeout(timerRef.current)

        // Start Timer
        timerRef.current = setTimeout(async () => {
            if (hasTriggeredRef.current) return
            hasTriggeredRef.current = true

            console.log(`MarketingTimer: Triggering ${eventType} for ${id}`)

            try {
                await fetch('/api/marketing/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventType, id })
                })
            } catch (e) {
                console.error("MarketingTimer Error", e)
            }

        }, delaySeconds * 1000)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [eventType, id, delaySeconds])

    return null
}
