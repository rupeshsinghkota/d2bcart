import { Metadata } from 'next'
import { MapPin, ShieldCheck, Store, Package } from 'lucide-react' // ProductCard removed, it is in client component
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSellerProductsAction } from '@/app/actions/seller'
import { SellerProductGrid } from '@/components/seller/SellerProductGrid'

// Initialize Supabase client for getSeller
const supabase = supabaseAdmin

interface Props {
    params: Promise<{ id: string }>
}

export const revalidate = 3600 // Revalidate every hour

async function getSeller(id: string) {
    const { data: seller } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .eq('user_type', 'manufacturer') // Ensure it is a seller
        .single()
    return seller
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params
    const seller = await getSeller(id)

    if (!seller) {
        return {
            title: 'Seller Not Found | D2BCart'
        }
    }

    return {
        title: `${seller.business_name} | D2BCart Seller`,
        description: `Shop wholesale products from ${seller.business_name} on D2BCart.`,
    }
}

export default async function SellerPage({ params }: Props) {
    const { id } = await params
    const seller = await getSeller(id)

    if (!seller) {
        notFound()
    }

    // Fetch initial products using the shared action
    const { products, total: totalCount } = await getSellerProductsAction(id, 1, 12)

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Seller Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        {/* Avatar / Logo Placeholder */}
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center border-2 border-white shadow-lg shadow-emerald-900/5">
                            <span className="text-3xl font-bold text-emerald-700">
                                {seller.business_name.substring(0, 1).toUpperCase()}
                            </span>
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{seller.business_name}</h1>
                                {seller.is_verified && (
                                    <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-bold border border-emerald-200">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Verified
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                                {seller.city && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        {seller.city}, {seller.state}
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <Store className="w-4 h-4 text-gray-400" />
                                    <span>Manufacturer</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    <span>{products.length} Products</span>
                                </div>
                                {/* <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>Joined {new Date(seller.created_at).toLocaleDateString()}</span>
                                </div> */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories Section */}
            {products.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Categories</h2>
                    <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(products.map((p: any) => {
                            const cat = p.category
                            if (!cat) return null
                            return JSON.stringify({
                                name: cat.name,
                                slug: cat.slug
                            })
                        }))).filter(Boolean).map((catStr: any) => {
                            const cat = JSON.parse(catStr)
                            return (
                                <div
                                    key={cat.slug}
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors shadow-sm"
                                >
                                    {cat.name}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Products Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-600" />
                    All Products
                </h2>

                <SellerProductGrid
                    initialProducts={products}
                    sellerId={id}
                    initialTotal={totalCount}
                />
            </div>
        </div>
    )
}
