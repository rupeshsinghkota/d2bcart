import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Admin client to bypass RLS and create users
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
    try {
        const { phone, email, name, business_name, address, city, state, pincode } = await req.json()

        if (!phone || !name || !address || !pincode) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const cleanPhone = phone.replace(/\D/g, '')
        const finalEmail = email || `${cleanPhone}@d2bcart.guest`
        const tempPassword = `D2B${cleanPhone}#${Math.floor(Math.random() * 1000)}`

        // 1. Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        // Note: listUsers isn't efficient for checking single user, but standard getUser lookup by phone/email 
        // via admin API is tricky without listUsers or dedicated lookup.
        // Better: Try to create, catch error if exists.

        // Actually, Supabase Admin create user will fail if phone/email exists.
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: finalEmail,
            phone: cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`, // Ensure format
            password: tempPassword,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
                full_name: name,
                business_name: business_name || name,
                phone: cleanPhone
            }
        })

        if (createError) {
            console.error('Guest Reg Error:', createError)
            // Check for "User already registered" error
            if (createError.message.includes('already registered') || createError.status === 422) {
                return NextResponse.json({
                    error: 'User already exists',
                    code: 'USER_EXISTS',
                    message: 'An account with this phone number already exists. Please login.'
                }, { status: 409 }) // Conflict
            }
            throw createError
        }

        if (!newUser.user) {
            throw new Error('Failed to create user object')
        }

        // 2. Create Profile Entry in 'users' table
        // The trigger *might* handle this, but for guest flow we want to be sure about the address fields.
        // Let's UPDATE the profile to ensure address is set.
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: newUser.user.id,
                email: finalEmail,
                phone: cleanPhone,
                business_name: business_name || name,
                user_type: 'retailer', // Explicitly set as retailer
                address,
                city,
                state,
                pincode,
                is_verified: true // Auto-verify guest for now to reduce friction? Or false? verified=true allows buying.
            })

        if (profileError) {
            console.error('Profile Creation Error:', profileError)
            // Continue anyway, user is created.
        }

        return NextResponse.json({
            success: true,
            user_id: newUser.user.id,
            email: finalEmail,
            password: tempPassword, // Return this ONE TIME so client can auto-login
            message: 'Account created successfully'
        })

    } catch (error: any) {
        console.error('Guest Register Exception:', error)
        return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 })
    }
}
