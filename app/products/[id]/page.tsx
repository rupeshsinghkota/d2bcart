import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import ProductDetailClient from './ProductDetailClient'
import { Product } from '@/types'
import { notFound } from 'next/navigation'

import { supabaseAdmin } from '@/lib/supabase-admin'

const supabase = supabaseAdmin

interface Props {
    params: Promise<{ id: string }>
}

export const revalidate = 3600 // Revalidate every hour

async function getProduct(id: string) {
    const { data } = await supabase
        .from('products')
        .select(`
      *,
      manufacturer:users!products_manufacturer_id_fkey(
        id, business_name, city, state, phone, is_verified
      ),
      category:categories!products_category_id_fkey(name, slug)
    `)
        .eq('id', id)
        .single()

    return data as Product | null
}

async function getVariations(product: Product) {
    const parentId = product.parent_id || product.id

    const { data } = await supabase
        .from('products')
        .select('*')
        .eq('parent_id', parentId)
        .order('name', { ascending: true })

    return (data as Product[]) || []
}

async function getManufacturerProducts(manufacturerId: string, currentProductId: string) {
    const { data } = await supabase
        .from('products')
        .select(`
        *,
        manufacturer:users!products_manufacturer_id_fkey(
            id, business_name, is_verified
        ),
        category:categories!products_category_id_fkey(name, slug)
    `)
        .eq('manufacturer_id', manufacturerId)
        .is('parent_id', null) // Only show main products in "More from Seller"
        .neq('id', currentProductId)
        .limit(6)

    return (data as Product[]) || []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params
    const product = await getProduct(id)

    if (!product) {
        return {
            title: 'Product Not Found',
        }
    }

    const description = product.description
        ? product.description.slice(0, 160)
        : `Buy ${product.name} wholesale from ${product.manufacturer?.business_name}. Direct to business pricing.`

    return {
        title: product.name,
        description: description,
        openGraph: {
            title: product.name,
            description: description,
            images: product.images && product.images.length > 0 ? [{ url: product.images[0] }] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title: product.name,
            description: description,
            images: product.images && product.images.length > 0 ? [product.images[0]] : [],
        },
    }
}

export default async function ProductPage({ params }: Props) {
    const { id } = await params
    const product = await getProduct(id)

    if (!product) {
        notFound()
    }

    const variations = await getVariations(product)

    let manufacturerProducts: Product[] = []
    if (product.manufacturer?.id) {
        manufacturerProducts = await getManufacturerProducts(product.manufacturer.id, product.id)
    }

    // B2B Schema Logic: Offer Price = Pack Price (MOQ * Unit Price)
    // We also define UnitPriceSpecification to tell Google about the per-unit cost
    const moq = product.moq || 1
    const unitPrice = product.display_price
    const packPrice = unitPrice * moq

    const isVariable = variations.length > 0
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL

    const jsonLd: any = {
        '@context': 'https://schema.org',
        '@type': isVariable ? 'ProductGroup' : 'Product',
        name: product.name,
        image: product.images,
        description: product.description,
        sku: product.sku || product.id,
        mpn: product.sku || undefined,
        url: `${baseUrl}/products/${product.id}`,
        brand: {
            '@type': 'Brand',
            name: product.manufacturer?.business_name || 'Generic'
        },
        offers: {
            '@type': 'Offer',
            price: packPrice, // IMPORTANT: Providing Pack Price to match Feed
            priceCurrency: 'INR',
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: `${baseUrl}/products/${product.id}`,
            seller: {
                '@type': 'Organization',
                name: product.manufacturer?.business_name || 'D2BCart Seller'
            },
            // B2B Specific: Explain this price is for {MOQ} units
            priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: unitPrice,
                priceCurrency: 'INR',
                referenceQuantity: {
                    '@type': 'QuantitativeValue',
                    value: '1',
                    unitCode: 'C62'
                }
            },
            eligibleQuantity: {
                '@type': 'QuantitativeValue',
                minValue: moq,
                unitCode: 'C62'
            }
        }
    }

    if (isVariable) {
        jsonLd.variesBy = ['https://schema.org/color', 'https://schema.org/material']
        jsonLd.hasVariant = variations.map(v => {
            const vMoq = v.moq || 1
            const vPackPrice = v.display_price * vMoq
            let deepLink = `${baseUrl}/products/${product.id}?variant=${v.id}`
            // Fallback: If name contains differentiator like 'Red'
            if (v.name) deepLink += `&color=${encodeURIComponent(v.name)}`

            return {
                '@type': 'Product',
                image: v.images?.[0] || product.images?.[0],
                sku: v.sku || v.id,
                name: `${product.name} - ${v.name}`,
                offers: {
                    '@type': 'Offer',
                    url: deepLink,
                    price: vPackPrice,
                    priceCurrency: 'INR',
                    availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                    priceSpecification: {
                        '@type': 'UnitPriceSpecification',
                        price: v.display_price,
                        priceCurrency: 'INR',
                        referenceQuantity: {
                            '@type': 'QuantitativeValue',
                            value: '1',
                            unitCode: 'C62'
                        }
                    }
                }
            }
        })
    }


    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProductDetailClient
                product={product}
                manufacturerProducts={manufacturerProducts}
                variations={variations}
            />
        </>
    )
}
