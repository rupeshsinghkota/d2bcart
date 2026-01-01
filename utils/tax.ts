
export interface TaxBreakdown {
    taxableAmount: number
    taxAmount: number
    taxType: 'IGST' | 'CGST_SGST'
    cgst: number
    sgst: number
    igst: number
    totalAmount: number
}

// 18% Standard GST Rate if not specified
const DEFAULT_GST_RATE = 18

/**
 * Calculates GST based on intra-state vs inter-state rules.
 * 
 * @param price Total price of items (before tax) or unit price
 * @param quantity Number of items
 * @param taxRate GST Rate percentage (e.g. 18 for 18%)
 * @param originState State of the Manufacturer (Seller)
 * @param destinationState State of the Retailer (Buyer)
 */
export function calculateTax(
    price: number,
    quantity: number,
    taxRate: number = DEFAULT_GST_RATE,
    originState?: string,
    destinationState?: string
): TaxBreakdown {
    const taxableAmount = price * quantity
    let taxAmount = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    let taxType: 'IGST' | 'CGST_SGST' = 'IGST' // Default to IGST if states unknown

    const rate = taxRate / 100

    // Normalize state names for comparison (simple check)
    // In a real app, use IDs or standardized codes.
    const isSameState = originState && destinationState &&
        originState.toLowerCase().trim() === destinationState.toLowerCase().trim()

    if (isSameState) {
        // Intra-state: CGST + SGST
        taxType = 'CGST_SGST'
        const halfRate = rate / 2
        cgst = taxableAmount * halfRate
        sgst = taxableAmount * halfRate
        taxAmount = cgst + sgst
    } else {
        // Inter-state: IGST
        taxType = 'IGST'
        igst = taxableAmount * rate
        taxAmount = igst
    }

    // Round to 2 decimals
    return {
        taxableAmount: Number(taxableAmount.toFixed(2)),
        taxAmount: Number(taxAmount.toFixed(2)),
        taxType,
        cgst: Number(cgst.toFixed(2)),
        sgst: Number(sgst.toFixed(2)),
        igst: Number(igst.toFixed(2)),
        totalAmount: Number((taxableAmount + taxAmount).toFixed(2))
    }
}
