export type UserType = 'manufacturer' | 'retailer' | 'admin'
export type OrderStatus = 'pending' | 'paid' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Category {
    id: string
    name: string
    slug: string
    markup_percentage: number
    image_url?: string
    parent_id?: string | null
    level?: number
    created_at: string
}

export interface User {
    id: string
    email: string
    phone?: string
    user_type: UserType
    business_name: string
    gst_number?: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    bank_account?: string
    ifsc_code?: string
    beneficiary_name?: string
    account_type?: string
    is_verified: boolean
    id_proof_url?: string
    created_at: string
}

export interface Product {
    id: string
    manufacturer_id: string
    category_id: string
    name: string
    description?: string
    base_price: number
    display_price: number
    your_margin: number
    moq: number
    stock: number
    images: string[]
    is_active: boolean
    created_at: string
    weight?: number // Added weight
    length?: number
    breadth?: number
    height?: number
    hsn_code?: string // Added GST/HSN
    tax_rate?: number // Added GST Tax Rate
    // Joined fields
    manufacturer?: User
    category?: Category
}

export interface Order {
    id: string
    order_number: string
    retailer_id: string
    manufacturer_id: string
    product_id: string
    quantity: number
    unit_price: number
    total_amount: number
    manufacturer_payout: number
    platform_profit: number
    status: OrderStatus
    payment_id?: string
    shipping_address?: string
    shipping_cost?: number // Added shipping_cost
    tracking_number?: string
    shipment_id?: string
    awb_code?: string
    courier_name?: string
    courier_company_id?: string
    shipping_label_url?: string
    created_at: string
    paid_at?: string
    shipped_at?: string
    delivered_at?: string
    // Joined fields
    product?: Product
    retailer?: User
    manufacturer?: User
}

export interface Payout {
    id: string
    manufacturer_id: string
    order_id: string
    amount: number
    status: PayoutStatus
    payment_reference?: string
    created_at: string
    completed_at?: string
}

export interface Wishlist {
    id: string
    user_id: string
    product_id: string
    created_at: string
}

export interface StockRequest {
    id: string
    user_id: string
    product_id: string
    status: 'pending' | 'notified'
    created_at: string
}

export interface Database {
    public: {
        Tables: {
            categories: {
                Row: Category
                Insert: Omit<Category, 'id' | 'created_at'>
                Update: Partial<Omit<Category, 'id' | 'created_at'>>
                Relationships: []
            }
            users: {
                Row: User
                Insert: Omit<User, 'created_at'>
                Update: Partial<Omit<User, 'id' | 'created_at'>>
                Relationships: []
            }
            products: {
                Row: Product
                Insert: Omit<Product, 'id' | 'created_at'>
                Update: Partial<Omit<Product, 'id' | 'created_at'>>
                Relationships: []
            }
            orders: {
                Row: Order
                Insert: Omit<Order, 'id' | 'created_at'>
                Update: Partial<Omit<Order, 'id' | 'created_at'>>
                Relationships: []
            }
            payouts: {
                Row: Payout
                Insert: Omit<Payout, 'id' | 'created_at'>
                Update: Partial<Omit<Payout, 'id' | 'created_at'>>
                Relationships: []
            }
            wishlists: {
                Row: Wishlist
                Insert: Omit<Wishlist, 'id' | 'created_at'>
                Update: Partial<Omit<Wishlist, 'id' | 'created_at'>>
                Relationships: []
            }
            stock_requests: {
                Row: StockRequest
                Insert: Omit<StockRequest, 'id' | 'created_at'>
                Update: Partial<Omit<StockRequest, 'id' | 'created_at'>>
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            toggle_verification: {
                Args: {
                    target_user_id: string
                    new_status: boolean
                }
                Returns: void
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
