import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { productId, interactionType, value } = body

        if (!productId || !interactionType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const supabase = await createClient()

        // Get User ID if logged in
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id || null

        // Get Session ID (Guest)
        const cookieStore = await cookies()
        let sessionId = cookieStore.get('session_id')?.value

        // If no session ID, create one and set cookie (if not logged in)
        if (!sessionId) {
            sessionId = crypto.randomUUID()
            // Note: In Next.js App Router, setting cookies in route handlers is done via response
        }

        // Insert Interaction
        const { error } = await supabase
            .from('user_interactions')
            .insert({
                user_id: userId,
                session_id: sessionId,
                product_id: productId,
                interaction_type: interactionType,
                value: value || 1
            })

        if (error) {
            console.error('Tracking Error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const response = NextResponse.json({ success: true })

        // Set session cookie if it was new
        if (!cookieStore.get('session_id')) {
            response.cookies.set('session_id', sessionId!, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: '/'
            })
        }

        return response
    } catch (error) {
        console.error('Tracking Handler Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
