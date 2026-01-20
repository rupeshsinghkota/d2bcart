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

    // 2. Auth & Validations... (already done above)
    // ...

    // 2.5 Check for Fresh Cache
    // We do this BEFORE fetching products to save DB reads if cache is hit
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

    // We need to typecase supabase as any or ignore TS for custom table if types aren't fully propagated yet
    const { data: cachedCatalog } = await (supabase
        .from('category_catalogs') as any)
        .select('*')
        .eq('category_id', categoryId)
        .gt('updated_at', twelveHoursAgo)
        .single()

    if (cachedCatalog && cachedCatalog.pdf_url) {
        // Cache Hit! Redirect to the stored PDF

        // Track Download for stats even on cache hit
        await supabase.from('catalog_downloads').insert({
            user_id: user.id,
            category_id: categoryId,
            source_page: 'api_cache_redirect'
        })

        return NextResponse.redirect(cachedCatalog.pdf_url)
    }

    // 2. Fetch Data (Existing logic...)
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

        // --- Header with Logo ---
        // Draw Logo Box (Emerald)
        doc.setFillColor(16, 185, 129) // Emerald-500
        doc.roundedRect(14, 15, 12, 12, 2, 2, 'F')

        // Draw 'D' inside
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text("D", 20, 23, { align: 'center' })

        // "D2BCart" Text
        doc.setFontSize(22)
        doc.setTextColor(16, 185, 129)
        doc.text("D2B", 29, 24)
        doc.setTextColor(16, 185, 129) // Keep same color or split? Navbar has "Cart" in emerald too.
        // Actually navbar text is "D2B" dark, "Cart" emerald.
        // Let's make "D2B" dark gray (33, 33, 33) and "Cart" emerald.
        doc.setTextColor(33, 33, 33)
        doc.text("D2B", 29, 24)
        const d2bWidth = doc.getTextWidth("D2B")
        doc.setTextColor(16, 185, 129)
        doc.text("Cart", 29 + d2bWidth, 24)

        // Subtitle "B2B Marketplace"
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.setFont('helvetica', 'normal')
        doc.text("B2B MARKETPLACE", 29, 29)


        // "Wholesale Price List" (moved down slightly)
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text("Wholesale Price List", 14, 38)

        // Category Title
        doc.setFontSize(16)
        doc.setTextColor(0)
        doc.setFont('helvetica', 'bold')
        doc.text(category.name, 14, 46)

        const dateStr = new Date().toLocaleDateString()
        doc.setFontSize(10)
        doc.setTextColor(120)
        doc.setFont('helvetica', 'normal')
        doc.text(`Generated on: ${dateStr}`, 14, 52)

        // --- Table Data ---
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'
        const tableRows: any[] = []

        // Pre-process rows to fetch images
        // We'll process them sequentially to avoid overwhelming network but using Promise.all for batches would be better.
        // For simplicity and reliability in this env, we map then await all.

        const rowPromises = products.map(async (p: any) => {
            const rows: any[] = []

            // Fetch Parent Image
            let imgData = null
            if (p.images && p.images.length > 0) {
                imgData = await getImageBase64(p.images[0])
            }

            // WhatsApp Message
            const waNumber = '917557777987'
            const productLink = `${baseUrl}/products/${p.id}`
            const message = `Hi, I am interested in this product: ${p.name} (SKU: ${p.sku || 'N/A'}). Link: ${productLink}`
            const chatUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`

            // Accumulate Data (Parent + Variations)
            let nameStr = p.name
            let moqStr = `${p.moq || 1}`
            let priceStr = `Rs. ${p.display_price}`

            // If variations exist, append them to the strings
            if (p.variations && p.variations.length > 0) {
                for (const v of p.variations) {
                    // Try to make variant name concise by removing parent name prefix
                    let vName = v.name
                    if (vName.toLowerCase().startsWith(p.name.toLowerCase())) {
                        vName = vName.slice(p.name.length).replace(/^[\s-–—]+/, '').trim()
                    }
                    if (!vName) vName = "Variant"

                    nameStr += `\n• ${vName}`
                    moqStr += `\n${v.moq || 1}`
                    priceStr += `\nRs. ${v.display_price}`
                }
            }

            rows.push({
                image: imgData,
                name: nameStr,
                moq: moqStr, // Removed "units" suffix to save space in condensed view
                price: priceStr,
                url: productLink,
                isLink: true,
                chatUrl: chatUrl
            })

            return rows
        })

        const nestedRows = await Promise.all(rowPromises)
        nestedRows.forEach(rows => tableRows.push(...rows))

        autoTable(doc, {
            startY: 60,
            head: [['Image', 'Product Name', 'MOQ', 'Price', 'Link', 'Chat']],
            body: tableRows.map(r => ['', r.name, r.moq, r.price, r.isLink ? 'View' : '', r.chatUrl ? 'Chat' : '']),
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            styles: {
                fontSize: 10,
                valign: 'middle',
                minCellHeight: 30
            },
            columnStyles: {
                0: { cellWidth: 35 },     // Image
                1: { cellWidth: 'auto' }, // Name
                2: { cellWidth: 20 },     // MOQ
                3: { cellWidth: 25, halign: 'right' }, // Price
                4: { cellWidth: 15, halign: 'center', textColor: [16, 185, 129] }, // View
                5: { cellWidth: 15, halign: 'center', textColor: [37, 211, 102] }  // Chat (WhatsApp Green)
            },
            didDrawCell: (data) => {
                // Image Drawing
                if (data.section === 'body' && data.column.index === 0) {
                    const rowData = tableRows[data.row.index]
                    if (rowData && rowData.image) {
                        try {
                            const cellHeight = data.cell.height
                            const cellWidth = data.cell.width
                            const imageSize = Math.min(cellHeight, cellWidth) - 4
                            const x = data.cell.x + (cellWidth - imageSize) / 2
                            const y = data.cell.y + (cellHeight - imageSize) / 2
                            doc.addImage(rowData.image, 'JPEG', x, y, imageSize, imageSize)
                        } catch (err) {
                            // Fail silently
                        }
                    }
                }

                // Link Drawing (View)
                if (data.section === 'body' && data.column.index === 4) {
                    const rowData = tableRows[data.row.index]
                    if (rowData && rowData.url) {
                        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
                            url: rowData.url
                        })
                    }
                }

                // Chat Link Drawing
                if (data.section === 'body' && data.column.index === 5) {
                    const rowData = tableRows[data.row.index]
                    if (rowData && rowData.chatUrl) {
                        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
                            url: rowData.chatUrl
                        })
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

        doc.text("Contact Support: +91-7557777987", 14, finalY + 55)

        // 4. Track Download (DB)
        await supabase.from('catalog_downloads').insert({
            user_id: user.id,
            category_id: categoryId,
            source_page: 'api_generated'
        })

        // 5. CACHE: Upload to Storage
        const pdfArrayBuffer = doc.output('arraybuffer')
        const pdfBuffer = Buffer.from(pdfArrayBuffer) // Need Buffer for Supabase Storage

        const fileName = `catalog_${categoryId}.pdf` // Consistent filename per category

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('catalogs') // Bucket name
            .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (!uploadError) {
            // Get Public URL
            const { data: { publicUrl } } = supabase
                .storage
                .from('catalogs')
                .getPublicUrl(fileName)

            // Upsert Cache Record
            await (supabase
                .from('category_catalogs') as any)
                .upsert({
                    category_id: categoryId,
                    pdf_url: publicUrl,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'category_id' })
        } else {
            console.error('Storage Upload Error:', uploadError)
        }

        // Return PDF directly
        return new NextResponse(pdfArrayBuffer, {
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
