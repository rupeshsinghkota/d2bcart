'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function AdTrackerContent() {
    const searchParams = useSearchParams()

    useEffect(() => {
        if (!searchParams) return

        const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid']
        const storageKey = 'd2b_attribution'

        let hasNewData = false
        const currentData: Record<string, any> = {}

        // Check for recognized keys
        attributionKeys.forEach(key => {
            const value = searchParams.get(key)
            if (value) {
                currentData[key] = value
                hasNewData = true
            }
        })

        if (hasNewData) {
            try {
                // Get existing data to merge (optional, but "Last Click Wins" usually overwrites conflicting keys)
                const existingJson = localStorage.getItem(storageKey)
                const existingData = existingJson ? JSON.parse(existingJson) : {}

                // Merge: New URL params overwrite old ones
                const newData = {
                    ...existingData,
                    ...currentData,
                    timestamp: Date.now() // Track when this click happened
                }

                localStorage.setItem(storageKey, JSON.stringify(newData))
                console.log('Ad Tracking: Captured', newData)
            } catch (e) {
                console.error('Ad Tracking Error:', e)
            }
        }
    }, [searchParams])

    return null
}

export function AdTracker() {
    return (
        <Suspense fallback={null}>
            <AdTrackerContent />
        </Suspense>
    )
}
