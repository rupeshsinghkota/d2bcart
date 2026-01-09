import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabase = await createClient()
    const { data } = await supabase.from('products').select('id, name, images').limit(5)
    return NextResponse.json(data)
}
