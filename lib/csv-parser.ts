import Papa from 'papaparse'

export interface CSVProduct {
    name: string
    description: string
    base_price: string
    moq: string
    stock: string
    category_slug: string
    image_url: string // Can be multiple comma-separated URLs
    sku?: string
    type?: string // 'simple', 'variable', 'variation'
    parent_sku?: string
    weight?: string
    length?: string
    breadth?: string
    height?: string
    hsn_code?: string
    tax_rate?: string
}

export interface ParseResult {
    data: CSVProduct[]
    errors: string[]
}

// Map WooCommerce headers to our CSVProduct interface
const WOOCOMMERCE_MAP: Record<string, keyof CSVProduct> = {
    'Name': 'name',
    'Description': 'description',
    'Regular price': 'base_price',
    'Stock': 'stock',
    'SKU': 'sku',
    'Type': 'type',
    'Parent': 'parent_sku',
    'Images': 'image_url',
    'Categories': 'category_slug',
    'Weight (kg)': 'weight',
    'Length (cm)': 'length',
    'Width (cm)': 'breadth',
    'Height (cm)': 'height',
    'moq': 'moq',
}

export const parseProductCSV = (file: File): Promise<ParseResult> => {
    return new Promise((resolve) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rawData = results.data as any[]
                const errors: string[] = []

                const validData: CSVProduct[] = []

                if (results.errors.length > 0) {
                    results.errors.forEach(err => errors.push(`Line ${err.row}: ${err.message}`))
                }

                rawData.forEach((row, index) => {
                    const rowNum = index + 2

                    // robustly get values with trimming
                    const getVal = (keys: string[]): string => {
                        for (const k of keys) {
                            if (row[k] !== undefined && row[k] !== null) {
                                return String(row[k]).trim()
                            }
                        }
                        return ''
                    }

                    const type = getVal(['type', 'Type']) || 'simple'
                    const isVariation = type.toLowerCase() === 'variation'

                    // Normalize WooCommerce data if detected
                    const normalizedRow: CSVProduct = {
                        name: getVal(['name', 'Name']),
                        description: getVal(['description', 'Description']),
                        base_price: getVal(['base_price', 'Regular price']) || (isVariation ? '0' : '0'),
                        moq: getVal(['moq', 'MOQ']) || (isVariation ? '10' : '1'),
                        stock: getVal(['stock', 'Stock']) || (isVariation ? '1000' : '0'),
                        category_slug: getVal(['category_slug', 'Categories']),
                        image_url: getVal(['image_url', 'Images']),
                        sku: getVal(['sku', 'SKU']),
                        type: type.toLowerCase(), // Normalize type to lowercase
                        parent_sku: getVal(['parent_sku', 'Parent']),
                        weight: getVal(['weight', 'Weight (kg)']) || '0.5',
                        length: getVal(['length', 'Length (cm)']) || '10',
                        breadth: getVal(['breadth', 'Width (cm)']) || '10',
                        height: getVal(['height', 'Height (cm)']) || '10',
                        hsn_code: getVal(['hsn_code', 'HSN']),
                        tax_rate: getVal(['tax_rate', 'Tax']) || '18'
                    }

                    const validationErrors = validateRow(normalizedRow)

                    if (validationErrors.length > 0) {
                        errors.push(`Row ${rowNum}: ${validationErrors.join(', ')}`)
                    } else {
                        validData.push(normalizedRow)
                    }
                })

                resolve({ data: validData, errors })
            },
            error: (error) => {
                resolve({ data: [], errors: [error.message] })
            }
        })
    })
}

const validateRow = (row: CSVProduct): string[] => {
    const errors: string[] = []

    // For variations, name might be empty in some formats, but WooCommerce usually has it
    if (!row.name?.trim() && row.type !== 'variation') errors.push('Name is required')

    // Base price is required unless it's a variable product (parent)
    if (row.type !== 'variable' && (!row.base_price || isNaN(Number(row.base_price)))) {
        errors.push('Valid Base Price is required')
    }

    // Stock and MOQ validation
    if (isNaN(Number(row.stock))) errors.push('Stock must be a number')
    if (isNaN(Number(row.moq))) errors.push('MOQ must be a number')

    // Category is required for main products
    if (row.type !== 'variation' && !row.category_slug?.trim()) {
        errors.push('Category Slug is required')
    }

    return errors
}

export const generateTemplate = () => {
    // Headers exactly matching WooCommerce export format
    const headers = [
        'Type', 'SKU', 'Name', 'Published', 'Is featured?', 'Visibility in catalog',
        'Short description', 'Description', 'Regular price', 'Categories', 'Images',
        'Parent', 'Attribute 1 name', 'Attribute 1 value(s)', 'Attribute 1 visible',
        'Attribute 1 global', 'Manage stock?', 'Stock', 'In stock?', 'MOQ'
    ]

    // Example: Variable product (parent) - Mobile Cover with choice models
    const variableProductSample = [
        'variable', 'LEATHER-CASE-001', 'Premium Leather Case', '1', '0', 'visible',
        '', 'Premium leather case for multiple phone models', '',
        'Electronics & Gadgets > Mobile Accessories > Cases & Covers',
        'https://example.com/leather-case-1.jpg, https://example.com/leather-case-2.jpg',
        '', 'Model', 'Samsung A06, Samsung A05, Vivo Y200, Redmi 13C',
        '1', '1', '0', '', '1', '10'
    ]

    // Example: Variation (child) - Specific model
    const variationSample = [
        'variation', 'LEATHER-CASE-001-SAMSUNG-A06', 'Premium Leather Case - Samsung A06',
        '1', '0', 'visible', '', '', '50',
        'Electronics & Gadgets > Mobile Accessories > Cases & Covers', '',
        'LEATHER-CASE-001', 'Model', 'Samsung A06', '', '1', '1', '1000', '1', '10'
    ]

    // Example: Another variation
    const variationSample2 = [
        'variation', 'LEATHER-CASE-001-VIVO-Y200', 'Premium Leather Case - Vivo Y200',
        '1', '0', 'visible', '', '', '50',
        'Electronics & Gadgets > Mobile Accessories > Cases & Covers', '',
        'LEATHER-CASE-001', 'Model', 'Vivo Y200', '', '1', '1', '1000', '1', '10'
    ]

    // Example: Simple product (no variations)
    const simpleProductSample = [
        'simple', 'FLIP-6-CLEAR', 'Samsung Z Flip 6 Clear Case with MagSafe',
        '1', '0', 'visible', '', 'Imported clear case with MagSafe support', '80',
        'Electronics & Gadgets > Mobile Accessories > Cases & Covers',
        'https://example.com/flip6-case.jpg', '', '', '', '', '', '1', '500', '1', '10'
    ]

    const csvContent = [
        headers.join(','),
        variableProductSample.map(s => `"${s}"`).join(','),
        variationSample.map(s => `"${s}"`).join(','),
        variationSample2.map(s => `"${s}"`).join(','),
        simpleProductSample.map(s => `"${s}"`).join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'd2bcart_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
}
