
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SupabaseClient } from '@supabase/supabase-js'

export async function generateAndUploadCatalog(
    categoryId: string,
    supabase: SupabaseClient
): Promise<string | null> {

    // 1. Check Cache
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const { data: cachedCatalog } = await (supabase
        .from('category_catalogs') as any)
        .select('*')
        .eq('category_id', categoryId)
        .gt('updated_at', twelveHoursAgo)
        .single()

    if (cachedCatalog && cachedCatalog.pdf_url) {
        return cachedCatalog.pdf_url
    }

    // 2. Fetch Data
    const { data: category, error: catError } = await supabase
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single()

    if (catError || !category) {
        console.error("Category not found", catError)
        return null
    }

    // Fetch products
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select(`
            id,
            name,
            slug,
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

    if (prodError || !products) {
        console.error("Failed to fetch products", prodError)
        return null
    }

    try {
        const doc = new jsPDF()

        const getImageBase64 = async (url: string): Promise<string | null> => {
            if (!url) return null
            try {
                const res = await fetch(url)
                if (!res.ok) return null
                const buffer = await res.arrayBuffer()
                const base64 = Buffer.from(buffer).toString('base64')
                const contentType = res.headers.get('content-type') || 'image/jpeg'
                return `data:${contentType};base64,${base64}`
            } catch (e) {
                return null
            }
        }

        // Header
        doc.setFillColor(16, 185, 129)
        doc.roundedRect(14, 15, 12, 12, 2, 2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text("D", 20, 23, { align: 'center' })

        doc.setFontSize(22)
        doc.setTextColor(33, 33, 33)
        doc.text("D2B", 29, 24)
        const d2bWidth = doc.getTextWidth("D2B")
        doc.setTextColor(16, 185, 129)
        doc.text("Cart", 29 + d2bWidth, 24)

        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.setFont('helvetica', 'normal')
        doc.text("B2B MARKETPLACE", 29, 29)

        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text("Wholesale Price List", 14, 38)

        doc.setFontSize(16)
        doc.setTextColor(0)
        doc.setFont('helvetica', 'bold')
        doc.text(category.name, 14, 46)

        const dateStr = new Date().toLocaleDateString()
        doc.setFontSize(10)
        doc.setTextColor(120)
        doc.setFont('helvetica', 'normal')
        doc.text(`Generated on: ${dateStr}`, 14, 52)

        // Table
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d2bcart.com'
        const tableRows: any[] = []

        const rowPromises = products.map(async (p: any) => {
            const rows: any[] = []

            let imgData = null
            if (p.images && p.images.length > 0) {
                imgData = await getImageBase64(p.images[0])
            }

            const waNumber = '917557777987'
            const productLink = `${baseUrl}/products/${p.slug || p.id}`
            const message = `Hi, I am interested in this product: ${p.name} (SKU: ${p.sku || 'N/A'}). Link: ${productLink}`
            const chatUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`

            let nameStr = p.name
            let moqStr = `${p.moq || 1}`
            let priceStr = `Rs. ${p.display_price}`

            if (p.variations && p.variations.length > 0) {
                for (const v of p.variations) {
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
                moq: moqStr,
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
                0: { cellWidth: 35 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20 },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 15, halign: 'center', textColor: [16, 185, 129] },
                5: { cellWidth: 15, halign: 'center', textColor: [37, 211, 102] }
            },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 0) {
                    const rowData = tableRows[data.row.index]
                    if (rowData && rowData.image) {
                        try {
                            const cellHeight = data.cell.height
                            const cellWidth = data.cell.width
                            const imageSize = Math.min(cellHeight, cellWidth) - 4
                            doc.addImage(rowData.image, 'JPEG', data.cell.x + 2, data.cell.y + 2, imageSize, imageSize)
                        } catch (err) { }
                    }
                }
                if (data.section === 'body' && data.column.index === 4) {
                    const rowData = tableRows[data.row.index]
                    if (rowData && rowData.url) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: rowData.url })
                }
                if (data.section === 'body' && data.column.index === 5) {
                    const rowData = tableRows[data.row.index]
                    if (rowData && rowData.chatUrl) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: rowData.chatUrl })
                }
            }
        })

        // Footer
        // @ts-ignore
        let finalY = doc.lastAutoTable.finalY || 80
        if (finalY > 250) {
            doc.addPage()
            finalY = 20
        }

        doc.setFontSize(10)
        doc.setTextColor(80)
        doc.text("Scan to view on D2BCart:", 14, finalY + 15)

        const categoryUrl = `${baseUrl}/categories`
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(categoryUrl)}`

        try {
            const qrRes = await fetch(qrUrl)
            if (qrRes.ok) {
                const qrBuffer = await qrRes.arrayBuffer()
                const qrBase64 = Buffer.from(qrBuffer).toString('binary')
                doc.addImage(qrBase64, 'PNG', 14, finalY + 20, 25, 25)
            }
        } catch (e) {
            doc.text("[Link: " + categoryUrl + "]", 14, finalY + 25)
        }

        doc.text("Contact Support: +91-7557777987", 14, finalY + 55)

        // Upload
        const pdfArrayBuffer = doc.output('arraybuffer')
        const pdfBuffer = Buffer.from(pdfArrayBuffer)
        const fileName = `catalog_${categoryId}.pdf`

        const { error: uploadError } = await supabase.storage.from('catalogs').upload(fileName, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true
        })

        if (uploadError) return null

        const { data: { publicUrl } } = supabase.storage.from('catalogs').getPublicUrl(fileName)

        await (supabase.from('category_catalogs') as any).upsert({
            category_id: categoryId,
            pdf_url: publicUrl,
            updated_at: new Date().toISOString()
        }, { onConflict: 'category_id' })

        return publicUrl

    } catch (error) {
        console.error('PDF Gen Error', error)
        return null
    }
}
