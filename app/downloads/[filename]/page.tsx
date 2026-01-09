
import { createClient } from '@/lib/supabase-server'
import Image from 'next/image'

export default async function CatalogPage({ params }: { params: Promise<{ filename: string }> }) {
    const { filename } = await params
    // 'filename' is essentially the category slug or ID
    // We try to find the category first

    const supabase = await createClient()

    // 1. Try to find the category by Slug
    let { data: category } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', filename)
        .single()

    // 2. If not found by slug, try ID (in case filename is an ID)
    if (!category) {
        let { data: catById } = await supabase
            .from('categories')
            .select('*')
            .eq('id', filename)
            .single()
        category = catById
    }

    if (!category) {
        return <div className="p-8 text-center">Category/Catalog not found for: {filename}</div>
    }

    // 3. Fetch Products for this Category (Limit 50 for the catalog)
    const { data: products } = await supabase
        .from('products')
        .select('*, manufacturer:users(business_name)')
        .eq('category_id', category.id)
        .eq('is_active', true)
        .limit(50)

    if (!products || products.length === 0) {
        return <div className="p-8 text-center">No products found in {category.name}</div>
    }

    return (
        <div className="max-w-4xl mx-auto bg-white min-h-screen p-8 print:p-0">
            {/* Header */}
            <div className="flex justify-between items-end mb-8 border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{category.name} Catalog</h1>
                    <p className="text-gray-500 mt-1">Generated on {new Date().toLocaleDateString()}</p>
                </div>
                <div className="print:hidden">
                    <button
                        // @ts-ignore
                        onClick="window.print()"
                        className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700"
                    >
                        Save as PDF
                    </button>
                    {/* Note: In Next.js Server Component we can't use onClick directly easily without client component
                        I'll make this a client component wrapper or just a simple script. 
                        Actually simpler: I'll make the whole page generic styling and let browser handle print.
                     */}
                </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {products.map((p) => (
                    <div key={p.id} className="border rounded-lg p-4 break-inside-avoid">
                        <div className="aspect-square relative mb-4 bg-gray-100 rounded overflow-hidden">
                            {p.images?.[0] ? (
                                <Image
                                    src={p.images[0]}
                                    alt={p.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-300">No Image</div>
                            )}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">{p.name}</h3>
                        <p className="text-xs text-gray-500 mb-2">Ref: {p.manufacturer?.business_name}</p>

                        <div className="mt-2 flex justify-between items-center">
                            <div>
                                <span className="text-xs text-gray-500 block">Starting from</span>
                                <span className="font-bold text-emerald-600">₹{p.display_price}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                                MOQ: {p.moq}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-4 border-t text-center text-sm text-gray-500">
                <p>Order online at d2bcart.com</p>
                <p className="text-xs mt-1">Prices subject to change.</p>
            </div>

            {/* Simple Print Script */}
            <script dangerouslySetInnerHTML={{
                __html: `
                document.querySelector('button').addEventListener('click', () => window.print())
            `}} />
        </div>
    )
}
