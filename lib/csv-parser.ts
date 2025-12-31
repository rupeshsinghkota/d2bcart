import Papa from 'papaparse'

export interface CSVProduct {
    name: string
    description: string
    base_price: string
    moq: string
    stock: string
    category_slug: string
    image_url: string
}

export interface ParseResult {
    data: CSVProduct[]
    errors: string[]
}

export const parseProductCSV = (file: File): Promise<ParseResult> => {
    return new Promise((resolve) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as CSVProduct[]
                const errors: string[] = []
                const validData: CSVProduct[] = []

                if (results.errors.length > 0) {
                    results.errors.forEach(err => errors.push(`Line ${err.row}: ${err.message}`))
                }

                data.forEach((row, index) => {
                    const rowNum = index + 2 // +1 for header, +1 for 0-index
                    const validationErrors = validateRow(row)

                    if (validationErrors.length > 0) {
                        errors.push(`Row ${rowNum}: ${validationErrors.join(', ')}`)
                    } else {
                        validData.push(row)
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

    if (!row.name?.trim()) errors.push('Name is required')
    if (!row.base_price || isNaN(Number(row.base_price))) errors.push('Valid Base Price is required')
    if (!row.stock || isNaN(Number(row.stock))) errors.push('Valid Stock is required')
    if (!row.moq || isNaN(Number(row.moq))) errors.push('Valid MOQ is required')
    if (!row.category_slug?.trim()) errors.push('Category Slug is required')

    return errors
}

export const generateTemplate = () => {
    const headers = ['name', 'description', 'base_price', 'moq', 'stock', 'category_slug', 'image_url']
    const sample = ['Sample Product', 'Description here', '100', '10', '50', 'electronics', 'https://example.com/image.jpg']

    const csvContent = [
        headers.join(','),
        sample.join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product_upload_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
}
