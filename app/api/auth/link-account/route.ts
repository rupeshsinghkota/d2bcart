import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This endpoint intelligently links an existing profile to a new Auth ID 
// if the phone number matches, solving the "I already have an account" issue.
export async function POST(req: Request) {
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
            .select('id')
            .eq('id', userId)
            .single()

        if (currentProfile) {
            // All good, user has a profile
            return NextResponse.json({ success: true, status: 'linked' })
        }

        // 2. Profile missing. Search for ORPHANED profile by PHONE.
        // We check varied formats to be safe.
        const formats = [
            phone, // +918000...
            phone.replace('+', ''), // 918000...
            phone.replace('+91', ''), // 8000...
            `91${phone.replace('+91', '')}` // Ensure 91 prefix
        ]

        // Remove duplicates and empty strings
        const searchPhones = [...new Set(formats)].filter(p => p && p.length >= 10)

        const { data: existingProfiles, error: searchError } = await supabaseAdmin
            .from('users')
            .select('*')
            .in('phone', searchPhones)

        if (searchError) throw searchError

        if (existingProfiles && existingProfiles.length > 0) {
            const oldProfile = existingProfiles[0] // Take the first match
            console.log(`Found orphaned profile [${oldProfile.id}] for phone [${phone}]. Migrating...`)

            // 3. MIGRATE: Update the old profile's ID to the new Auth ID
            // This effectively transfers ownership of the data (Orders, Products) to the new login.
            // NOTE: This assumes ON UPDATE CASCADE is set on FKs, or that we manually update.
            // Since we don't know the schema constraints, we try the update.

            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    id: userId, // The NEW Auth ID
                    is_verified: true, // They just verified OTP, so yes
                    phone: phone // Standardize the phone format
                })
                .eq('id', oldProfile.id)

            if (updateError) {
                console.error('Migration failed (FK Restriction possible):', updateError)
                // If direct update fails (e.g. FK restrict), we might need a stored procedure or deep migration
                // For now, we report error.
                return NextResponse.json({ error: 'Account link failed. Please contact support.', details: updateError }, { status: 500 })
            }

            return NextResponse.json({ success: true, status: 'migrated', previous_id: oldProfile.id })
        }

        // 4. No profile found at all -> New User
        return NextResponse.json({ success: true, status: 'new_user' })

    } catch (error: any) {
        console.error('Account Link Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
