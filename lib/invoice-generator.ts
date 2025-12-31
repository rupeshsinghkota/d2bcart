import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Order } from '@/types'
import { formatCurrency, formatDate } from './utils'

export const generateInvoice = (order: Order) => {
    const doc = new jsPDF()

    // --- Header ---
    doc.setFontSize(20)
    doc.setTextColor(40)
    doc.text("TAX INVOICE", 14, 22)

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Invoice #: INV-${order.order_number}`, 14, 30)
    doc.text(`Date: ${formatDate(order.created_at)}`, 14, 35)
    if (order.awb_code) {
        doc.text(`AWB: ${order.awb_code}`, 14, 40)
    }

    // --- Seller (Manufacturer) Details ---
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text("Sold By:", 14, 55)
    doc.setFontSize(10)
    doc.setTextColor(80)
    const manufacturer = order.manufacturer as any
    doc.text(manufacturer?.business_name || "Manufacturer", 14, 62)
    doc.text(manufacturer?.address || "", 14, 67)
    doc.text(`${manufacturer?.city || ""}, ${manufacturer?.state || ""} - ${manufacturer?.pincode || ""}`, 14, 72)
    doc.text(`Email: ${manufacturer?.email || "N/A"}`, 14, 77)

    // --- Buyer (Retailer) Details ---
    const retailer = order.retailer as any
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text("Billing Address:", 110, 55)
    doc.setFontSize(10)
    doc.setTextColor(80)
    doc.text(retailer?.business_name || "Retailer", 110, 62)
    doc.text(order.shipping_address || retailer?.address || "", 110, 67)
    doc.text(`Phone: ${retailer?.phone || "N/A"}`, 110, 72)

    // --- Order Table ---
    const tableColumn = ["Item", "Quantity", "Unit Price", "Tax (18%)", "Total"]
    const taxAmount = (order.unit_price * 0.18) * order.quantity
    const subTotal = (order.unit_price * 0.82) * order.quantity // Assuming price includes tax for simplicity, varies by business logic

    const tableRows = [
        [
            order.product?.name || "Product",
            order.quantity,
            formatCurrency(order.unit_price),
            formatCurrency(taxAmount),
            formatCurrency(order.quantity * order.unit_price)
        ]
    ]

    // Add Shipping row if exists
    if (order.shipping_cost && order.shipping_cost > 0) {
        tableRows.push([
            "Shipping Charges",
            1,
            formatCurrency(order.shipping_cost),
            formatCurrency(order.shipping_cost * 0.18),
            formatCurrency(order.shipping_cost)
        ])
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

    doc.setFontSize(10)
    doc.text(`Subtotal:`, 140, finalY + 15)
    doc.text(formatCurrency(order.total_amount), 170, finalY + 15, { align: "right" })

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`Grand Total:`, 140, finalY + 25)
    doc.text(formatCurrency(order.total_amount), 170, finalY + 25, { align: "right" })

    // --- Footer ---
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(150)
    doc.text("This is a computer generated invoice and does not require a signature.", 14, 280)
    doc.text("D2BCart Marketplace", 14, 285)

    doc.save(`Invoice_${order.order_number}.pdf`)
}
