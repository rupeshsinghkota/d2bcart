import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Initialize Supabase Admin client for secure data fetching (ignoring RLS if needed, or just use context)
// But better to use the request context user.
// However, creating a route handler client is standard. 
// Since we don't have @supabase/auth-helpers-nextjs, we use standard setup or @supabase/ssr?
// package.json has "@supabase/ssr": "^0.8.0"
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'


export async function GET(
    request: NextRequest,
    context: { params: Promise<{ categoryId: string }> }
) {
    const { categoryId } = await context.params

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    const parsed = parseCookieHeader(request.headers.get('Cookie') ?? '')
                    return parsed.map(c => ({ name: c.name, value: c.value ?? '' }))
                },
                setAll(cookiesToSet) {
                    // We don't need to set cookies in this GET request usually
                },
            },
        }
    )

    // 1. Security Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch Data
    const { data: category, error: catError } = await supabase
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single()

    if (catError || !category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Fetch products with their variations
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select(`
            id,
            name,
            sku,
            base_price,
            display_price,
            moq,
            variations:products!parent_id(
                id,
                name,
                sku,
                display_price,
                moq
            )
        `)
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .is('parent_id', null) // Only fetch parents, variations are joined
        .order('name')

    if (prodError) {
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    try {
        // 3. Generate PDF
        // Note: jsPDF in Node might require 'new jsPDF.default()' depending on import.
        // Assuming standard import works as per typical ESM in Next.js.
        const doc = new jsPDF()

        // --- Header ---
        doc.setFontSize(22)
        doc.setTextColor(16, 185, 129) // Emerald-500
        doc.text("D2BCart", 14, 20)

        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text("Wholesale Price List", 14, 26)

        // Category Title
        doc.setFontSize(16)
        doc.setTextColor(0)
        doc.text(category.name, 14, 40)

        doc.setFontSize(10)
        doc.setTextColor(120)
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 46)

        // --- Table Data ---
        const tableRows: any[] = []

        products.forEach((p: any) => {
            // Parent Row
            let price = `Rs. ${p.display_price}`
            let moq = `${p.moq || 1} units`

            // If has variations, maybe summarize or list them? 
            // For catalog, listing variations is better if it's a "Line Sheet".
            // Let's list the parent first
            tableRows.push([
                p.name,
                p.sku || '-',
                moq,
                price
            ])

            // Variations
            if (p.variations && p.variations.length > 0) {
                p.variations.forEach((v: any) => {
                    const vName = v.name === p.name ? `${v.name} (Variant)` : v.name
                    tableRows.push([
                        `  - ${vName}`, // Indent
                        v.sku || '-',
                        `${v.moq || 1} units`,
                        `Rs. ${v.display_price}`
                    ])
                })
            }
        })

        autoTable(doc, {
            startY: 55,
            head: [['Product Name', 'SKU', 'MOQ', 'Wholesale Price']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 'auto' }, // Name
                1: { cellWidth: 30 },     // SKU
                2: { cellWidth: 30 },     // MOQ
                3: { cellWidth: 30, halign: 'right' } // Price
            }
        })

        // --- Footer ---
        // @ts-ignore
        let finalY = doc.lastAutoTable.finalY || 80
        if (finalY > 250) {
            doc.addPage()
            finalY = 20
        }

        doc.setFontSize(10)
        doc.setTextColor(80)
        doc.text("Scan to view on D2BCart:", 14, finalY + 15)

        // QR Code Implementation using Public API (as qrcode package is missing)
        // https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=...
        const categoryUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'}/categories` // Linking to main cat page for now as slug not readily available without join
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(categoryUrl)}`

        try {
            const qrRes = await fetch(qrUrl)
            if (qrRes.ok) {
                const qrBuffer = await qrRes.arrayBuffer()
                const qrBase64 = Buffer.from(qrBuffer).toString('binary')
                doc.addImage(qrBase64, 'PNG', 14, finalY + 20, 25, 25)
            }
        } catch (e) {
            console.error("QR Fetch failed", e)
            doc.text("[Link: " + categoryUrl + "]", 14, finalY + 25)
        }

        doc.text("Contact Support: +91-9117474683", 14, finalY + 55)

        // 4. Track Download
        // Fire and forget tracking to database
        const { error: trackError } = await supabase
            .from('catalog_downloads')
            .insert({
                user_id: user.id,
                category_id: categoryId,
                source_page: 'api_direct'
            })

        if (trackError) console.error('Tracking Error:', trackError)

        // 5. Return PDF
        // output('arraybuffer') returns an ArrayBuffer
        const pdfBuffer = doc.output('arraybuffer')

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${category.name.replace(/\s+/g, '_')}_Catalog.pdf"`
            }
        })

    } catch (error) {
        console.error('PDF Generation Error:', error)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
