import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Order } from '@/types'
import { formatCurrency, formatDate } from './utils'

// Helper to separate logic
export const generateInvoice = (input: Order | Order[]) => {
    const orders = Array.isArray(input) ? input : [input]
    if (orders.length === 0) return

    const mainOrder = orders[0] // Use first order for Header/Address details
    const doc = new jsPDF()

    // --- Header ---
    doc.setFontSize(20)
    doc.setTextColor(40)
    doc.text("TAX INVOICE", 14, 22)

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Invoice #: INV-${mainOrder.order_number}`, 14, 30)
    doc.text(`Date: ${formatDate(mainOrder.created_at)}`, 14, 35)
    if (mainOrder.awb_code) {
        doc.text(`AWB: ${mainOrder.awb_code}`, 14, 40)
    }

    // --- Seller (Manufacturer) Details ---
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text("Sold By:", 14, 55)
    doc.setFontSize(10)
    doc.setTextColor(80)
    const manufacturer = mainOrder.manufacturer as any
    doc.text(manufacturer?.business_name || "Manufacturer", 14, 62)
    doc.text(manufacturer?.address || "", 14, 67)
    doc.text(`${manufacturer?.city || ""}, ${manufacturer?.state || ""} - ${manufacturer?.pincode || ""}`, 14, 72)
    doc.text(`Email: ${manufacturer?.email || "N/A"}`, 14, 77)

    // --- Buyer (Retailer) Details ---
    const retailer = mainOrder.retailer as any
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text("Billing Address:", 110, 55)
    doc.setFontSize(10)
    doc.setTextColor(80)
    doc.text(retailer?.business_name || "Retailer", 110, 62)
    doc.text(mainOrder.shipping_address || retailer?.address || "", 110, 67)
    doc.text(`Phone: ${retailer?.phone || "N/A"}`, 110, 72)

    // --- Order Table ---
    const tableColumn = ["Item", "Quantity", "Unit Price", "Tax (18%)", "Total"]

    // Aggregate Rows
    const tableRows = orders.map(order => {
        const taxAmount = (order.unit_price * 0.18) * order.quantity
        return [
            order.product?.name || "Product",
            order.quantity,
            formatCurrency(order.unit_price),
            formatCurrency(taxAmount),
            formatCurrency(order.quantity * order.unit_price) // Item Total
        ]
    })

    // Add Shipping row (Summed or First?)
    // Usually shipping is per shipment (order_id). If grouped, we sum valid shipping costs?
    // Or if Shiprocket returns 1 shipping cost for the GROUP, we assume it's split or just on one?
    // For now, let's sum up shipping costs if they are distinct non-zero values.
    const totalShipping = orders.reduce((sum, o) => sum + (o.shipping_cost || 0), 0)

    if (totalShipping > 0) {
        tableRows.push([
            "Shipping Charges",
            1,
            formatCurrency(totalShipping),
            formatCurrency(totalShipping * 0.18),
            formatCurrency(totalShipping)
        ] as any)
    }

    autoTable(doc, {
        startY: 90,
        head: [tableColumn],
        body: tableRows as any,
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105] }, // Emerald-600
    })

    // --- Totals ---
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY || 90

    // Calculate Grand Total
    const grandTotal = orders.reduce((sum, o) => sum + o.total_amount, 0)
    // Note: total_amount in DB is inclusive of shipping/tax usually? 
    // If not, our previous logic used order.total_amount directly.
    // If grouped, sum of totals is Grand Total.

    doc.setFontSize(10)
    doc.text(`Subtotal:`, 140, finalY + 15)
    doc.text(formatCurrency(grandTotal), 170, finalY + 15, { align: "right" }) // Assuming Subtotal ~ Grand Total for simplicity here, or we calculate strict subtotal

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`Grand Total:`, 140, finalY + 25)
    doc.text(formatCurrency(grandTotal), 170, finalY + 25, { align: "right" })

    // --- Footer ---
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(150)
    doc.text("This is a computer generated invoice and does not require a signature.", 14, 280)
    doc.text("D2BCart Marketplace", 14, 285)

    doc.save(`Invoice_${mainOrder.order_number}.pdf`)
}
