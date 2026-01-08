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
            images,
            variations:products!parent_id(
                id,
                name,
                sku,
                display_price,
                moq,
                images
            )
        `)
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .is('parent_id', null)
        .order('name')

    if (prodError) {
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    try {
        const doc = new jsPDF()

        // Helper to fetch image as base64
        const getImageBase64 = async (url: string): Promise<string | null> => {
            if (!url) return null
            try {
                const res = await fetch(url)
                if (!res.ok) return null
                const buffer = await res.arrayBuffer()
                const base64 = Buffer.from(buffer).toString('base64')
                const contentType = res.headers.get('content-type') || 'image/jpeg'
                let format = 'JPEG'
                if (contentType.includes('png')) format = 'PNG'
                if (contentType.includes('webp')) format = 'WEBP' // jsPDF might struggle with webp usually, but let's try or it will fail gracefully
                return `data:${contentType};base64,${base64}`
            } catch (e) {
                console.error('Image fetch error', e)
                return null
            }
        }

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

        // Pre-process rows to fetch images
        // We'll process them sequentially to avoid overwhelming network but using Promise.all for batches would be better.
        // For simplicity and reliability in this env, we map then await all.

        const rowPromises = products.map(async (p: any) => {
            const rows: any[] = []

            // Parent Row
            let price = `Rs. ${p.display_price}`
            let moq = `${p.moq || 1} units`

            // Fetch Parent Image
            let imgData = null
            if (p.images && p.images.length > 0) {
                imgData = await getImageBase64(p.images[0])
            }

            rows.push({
                image: imgData,
                name: p.name,
                sku: p.sku || '-',
                moq: moq,
                price: price
            })

            // Variations
            if (p.variations && p.variations.length > 0) {
                for (const v of p.variations) {
                    const vName = v.name === p.name ? `${v.name} (Variant)` : v.name

                    // Variation Image (fallback to parent if none)
                    // Usually we don't show image for every variant to save space unless it's different?
                    // Let's show it if it exists distinct from parent, otherwise null (cleaner table)
                    let vImgData = null
                    if (v.images && v.images.length > 0) {
                        vImgData = await getImageBase64(v.images[0])
                    }

                    rows.push({
                        image: vImgData, // Optional: if we want to show variant images
                        name: `  - ${vName}`,
                        sku: v.sku || '-',
                        moq: `${v.moq || 1} units`,
                        price: `Rs. ${v.display_price}`
                    })
                }
            }
            return rows
        })

        const nestedRows = await Promise.all(rowPromises)
        nestedRows.forEach(rows => tableRows.push(...rows))

        autoTable(doc, {
            startY: 55,
            head: [['Image', 'Product Name', 'SKU', 'MOQ', 'Wholesale Price']],
            body: tableRows.map(r => ['', r.name, r.sku, r.moq, r.price]), // Empty string for image cell, we draw it manually
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            styles: {
                fontSize: 9,
                valign: 'middle',
                minCellHeight: 15 // Ensure row is tall enough for image
            },
            columnStyles: {
                0: { cellWidth: 20 },     // Image
                1: { cellWidth: 'auto' }, // Name
                2: { cellWidth: 25 },     // SKU
                3: { cellWidth: 25 },     // MOQ
                4: { cellWidth: 25, halign: 'right' } // Price
            },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 0) {
                    const rowData = tableRows[data.row.index]
                    if (rowData && rowData.image) {
                        try {
                            // padding 1mm
                            const dim = data.cell.height - 2
                            const x = data.cell.x + 1
                            const y = data.cell.y + 1
                            doc.addImage(rowData.image, 'JPEG', x, y, dim, dim)
                        } catch (err) {
                            // Fail silently for bad images
                        }
                    }
                }
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
