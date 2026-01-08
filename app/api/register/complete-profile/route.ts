import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const { userId, user_type, business_name, phone, gst_number, city, state, pincode, address } = await req.json()

        if (!userId || !user_type || !business_name || !phone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

        // 1. Verify User exists in Auth (Optional safety check)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)

        if (authError || !authUser.user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // 2. Check if profile already exists (Idempotency)
        const { data: existingProfile } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', userId)
            .single()

        if (existingProfile) {
            return NextResponse.json({ error: 'Profile already exists' }, { status: 400 })
        }

        // 3. Create Public Profile
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                email: authUser.user.email || `${phone}@d2bcart.com`, // Fallback email if phone-only
                user_type,
                business_name,
                phone, // Ensure this matches what was sent
                gst_number: gst_number || null,
                city,
                state,
                pincode,
                address,
                is_verified: false
            })

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 })
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Profile Completion Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
