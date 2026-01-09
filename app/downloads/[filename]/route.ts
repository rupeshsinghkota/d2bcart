
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    const { filename } = await context.params

    let finalFilename = filename
    if (!filename.endsWith('.pdf')) {
        // Assume it's a category slug, format as catalog_{slug}.pdf
        finalFilename = `catalog_${filename}.pdf`
    }

    // Construct Supabase Public URL
    // Pattern: `catalog_${categoryId}.pdf`
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const projectId = supabaseUrl?.split('.')[0].split('//')[1] // Extract project ID if consistent, or just use getPublicUrl

    // Better: Use SDK to get public URL to ensure consistency
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll() { return [] }, setAll() { } } }
    )

    const { data: { publicUrl } } = supabase
        .storage
        .from('catalogs')
        .getPublicUrl(finalFilename)

    // Redirect to the actual storage file
    return NextResponse.redirect(publicUrl)
}
