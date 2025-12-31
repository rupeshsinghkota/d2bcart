"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ProductStats {
    name: string
    sales: number
    revenue: number
    image?: string
}

interface TopProductsProps {
    products: ProductStats[]
}

export function TopProducts({ products }: TopProductsProps) {

    return (
        <Card>
            <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-8">
                    {products.map((product, index) => (
                        <div key={index} className="flex items-center">
                            {/* <Avatar className="h-9 w-9">
                <AvatarImage src={product.image} alt="Avatar" />
                <AvatarFallback>OM</AvatarFallback>
              </Avatar> */}
                            <div className="ml-4 space-y-1">
                                <p className="text-sm font-medium leading-none">{product.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {product.sales} sales
                                </p>
                            </div>
                            <div className="ml-auto font-medium">+{formatCurrency(product.revenue)}</div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
