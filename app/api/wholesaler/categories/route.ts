import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        // Forward the user's authorization token to Supabase
        const authHeader = request.headers.get('Authorization')

        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: authHeader,
                    },
                },
            }
        )

        // Get current user to verify token is valid and get ID
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch selected categories
        const { data, error } = await supabase
            .from('manufacturer_categories')
            .select('category_id')
            .eq('manufacturer_id', user.id)

        if (error) {
            console.error('Error fetching manufacturer categories:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            categories: data.map((item: any) => item.category_id)
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: authHeader,
                    },
                },
            }
        )

        const { categories } = await request.json()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!Array.isArray(categories)) {
            return NextResponse.json({ error: 'Invalid categories format' }, { status: 400 })
        }

        // 1. Delete existing connections
        const { error: deleteError } = await supabase
            .from('manufacturer_categories')
            .delete()
            .eq('manufacturer_id', user.id)

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 })
        }

        // 2. Insert new connections (if any)
        if (categories.length > 0) {
            const rows = categories.map((catId: string) => ({
                manufacturer_id: user.id,
                category_id: catId
            }))

            const { error: insertError } = await supabase
                .from('manufacturer_categories')
                .insert(rows)

            if (insertError) {
                return NextResponse.json({ error: insertError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, count: categories.length })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
