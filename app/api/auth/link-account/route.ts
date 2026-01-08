import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This endpoint intelligently links an existing profile to a new Auth ID 
// if the phone number matches, solving the "I already have an account" issue.
export async function POST(req: Request) {
    console.log('--- Link Account API Triggered ---')
    try {
        const { userId, phone } = await req.json()

        if (!userId || !phone) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // 1. Check if profile exists for this Auth ID
        const { data: currentProfile } = await supabaseAdmin
            .from('users')
            .select('id, user_type')
            .eq('id', userId)
            .single()

        if (currentProfile) {
            console.log('Profile already linked:', currentProfile.id)
            return NextResponse.json({ success: true, status: 'linked', user_type: currentProfile.user_type })
        }

        // 2. Profile missing. Search for ORPHANED profile by PHONE.
        // We generate multiple formats to catch variations like "+91 999..." or "99999 99999"
        // Strip everything except digits
        const digits = phone.replace(/\D/g, '')
        // Extract last 10 digits (India standard)
        const last10 = digits.slice(-10)

        const formats = [
            phone, // Original
            `+91${last10}`,
            `91${last10}`,
            last10,
            `+91 ${last10}`,
            `${last10.slice(0, 5)} ${last10.slice(5)}`, // 99999 99999
            `+91 ${last10.slice(0, 5)} ${last10.slice(5)}` // +91 99999 99999
        ]

        // Remove duplicates and empty strings
        const searchPhones = [...new Set(formats)].filter(p => p && p.length >= 10)
        console.log('Searching for orphaned profile with formats:', searchPhones)

        const { data: existingProfiles, error: searchError } = await supabaseAdmin
            .from('users')
            .select('*')
            .in('phone', searchPhones)

        if (searchError) throw searchError

        if (existingProfiles && existingProfiles.length > 0) {
            const oldProfile = existingProfiles[0] // Take the first match
            console.log(`Found orphaned profile [${oldProfile.id}] for phone [${phone}]. Migrating...`)

            // 3. MIGRATE: Attempt direct ID update first
            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    id: userId, // The NEW Auth ID
                    is_verified: true,
                    phone: phone // Updates to the verified format
                })
                .eq('id', oldProfile.id)

            if (!updateError) {
                console.log('Direct migration successful.')
                return NextResponse.json({ success: true, status: 'migrated', method: 'direct', user_type: oldProfile.user_type })
            }

            console.error('Direct update failed (likely FK constraints), attempting Deep Clone...', updateError)

            // 4. PLAN B: Clone & Relink (for Foreign Key Constraints)

            // 4a. Rename Old Profile Email to avoid unique constraint conflict completely
            const tempEmail = `${oldProfile.id}_temp_${Date.now()}@migration.com`
            await supabaseAdmin.from('users').update({ email: tempEmail }).eq('id', oldProfile.id)

            // 4b. Insert New Profile (Clone)
            const { error: insertError } = await supabaseAdmin
                .from('users')
                .insert({
                    ...oldProfile,
                    id: userId, // NEW ID
                    email: oldProfile.email, // Keep original email
                    phone: phone, // Keep verified phone
                    is_verified: true,
                    created_at: new Date().toISOString()
                })

            if (insertError) {
                console.error('Clone insert failed:', insertError)
                // Revert temp email to try and save state? Or just fail.
                return NextResponse.json({ error: 'Clone failed', details: insertError }, { status: 500 })
            }

            // 4c. Relink Child Tables (Orders, Products, etc.) to New ID
            // We run these in parallel
            const tablesWithManufacturerId = ['orders', 'products', 'payouts']
            const tablesWithRetailerId = ['orders'] // orders uses both
            const tablesWithUserId = ['wishlists', 'stock_requests']

            await Promise.all([
                ...tablesWithManufacturerId.map(t =>
                    supabaseAdmin.from(t).update({ manufacturer_id: userId }).eq('manufacturer_id', oldProfile.id)
                ),
                ...tablesWithRetailerId.map(t =>
                    supabaseAdmin.from(t).update({ retailer_id: userId }).eq('retailer_id', oldProfile.id)
                ),
                ...tablesWithUserId.map(t =>
                    supabaseAdmin.from(t).update({ user_id: userId }).eq('user_id', oldProfile.id)
                )
            ])

            // 4d. Delete Old Profile
            await supabaseAdmin.from('users').delete().eq('id', oldProfile.id)

            console.log('Deep clone migration successful.')
            return NextResponse.json({ success: true, status: 'migrated', method: 'deep_clone', user_type: oldProfile.user_type })
        }

        console.log('No orphaned profile found.')
        // 4. No profile found at all -> New User
        return NextResponse.json({ success: true, status: 'new_user', searched: searchPhones })

    } catch (error: any) {
        console.error('Account Link Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
