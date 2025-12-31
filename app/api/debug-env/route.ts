import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json({
        email: process.env.SHIPROCKET_EMAIL,
        pw_len: process.env.SHIPROCKET_PASSWORD?.length,
        service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
}
