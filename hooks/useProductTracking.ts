'use client'

import { useEffect, useRef } from 'react'

export function useProductTracking(productId: string) {
    const startTimeRef = useRef<number>(Date.now())
    const totalTimeRef = useRef<number>(0)
    const isVisibleRef = useRef<boolean>(true)

    // Send data helper
    const sendTrackingData = (type: 'view' | 'time_spent', value?: number) => {
        try {
            const data = {
                productId,
                interactionType: type,
                value
            }

            // Utilize Beacon API for reliability during page unload
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
            navigator.sendBeacon('/api/tracking', blob)
        } catch (e) {
            console.error('Tracking failed', e)
        }
    }

    useEffect(() => {
        // 1. Send View Event on Mount
        // Use fetch for 'view' as we want confirmation/cookie setting
        fetch('/api/tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, interactionType: 'view' })
        }).catch(err => console.error('View tracking failed', err))

        // Visibility Change Handler
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab Hidden: Pause timer
                if (isVisibleRef.current) {
                    const duration = (Date.now() - startTimeRef.current) / 1000
                    totalTimeRef.current += duration
                    isVisibleRef.current = false
                }
            } else {
                // Tab Visible: Resume timer
                if (!isVisibleRef.current) {
                    startTimeRef.current = Date.now()
                    isVisibleRef.current = true
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)

            // Calculate final duration
            if (isVisibleRef.current) {
                const duration = (Date.now() - startTimeRef.current) / 1000
                totalTimeRef.current += duration
            }

            // Send Time Spent Event (only if significant, e.g. > 1s)
            if (totalTimeRef.current > 1) {
                sendTrackingData('time_spent', Math.round(totalTimeRef.current))
            }
        }
    }, [productId])
}
