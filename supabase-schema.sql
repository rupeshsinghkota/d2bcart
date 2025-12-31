-- =============================================
-- D2BCART DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. CATEGORIES (with markup percentage)
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  markup_percentage DECIMAL(5,2) DEFAULT 15.00,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (manufacturers & retailers)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  user_type TEXT CHECK (user_type IN ('manufacturer', 'retailer', 'admin')) NOT NULL,
  business_name TEXT NOT NULL,
  gst_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  bank_account TEXT,
  ifsc_code TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  manufacturer_id UUID REFERENCES users(id) NOT NULL,
  category_id UUID REFERENCES categories(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  display_price DECIMAL(10,2) NOT NULL,
  your_margin DECIMAL(10,2) NOT NULL,
  moq INTEGER DEFAULT 1,
  stock INTEGER DEFAULT 0,
  images TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  retailer_id UUID REFERENCES users(id) NOT NULL,
  manufacturer_id UUID REFERENCES users(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  manufacturer_payout DECIMAL(10,2) NOT NULL,
  platform_profit DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_id TEXT,
  shipping_address TEXT,
  tracking_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- 5. PAYOUTS (to manufacturers)
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  manufacturer_id UUID REFERENCES users(id) NOT NULL,
  order_id UUID REFERENCES orders(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 6. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_retailer ON orders(retailer_id);
CREATE INDEX IF NOT EXISTS idx_orders_manufacturer ON orders(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);

-- 7. Sample Categories with Markup Percentages
INSERT INTO categories (name, slug, markup_percentage) VALUES
('Electronics', 'electronics', 12),
('Mobile Accessories', 'mobile-accessories', 20),
('Fashion & Apparel', 'fashion', 25),
('FMCG & Grocery', 'fmcg', 10),
('Hardware & Tools', 'hardware', 18),
('Stationery', 'stationery', 30),
('Home & Kitchen', 'home-kitchen', 15),
('Beauty & Cosmetics', 'beauty', 22),
('Sports & Fitness', 'sports', 15),
('Toys & Games', 'toys', 20)
ON CONFLICT (slug) DO NOTHING;

-- 8. ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Categories: Anyone can read
CREATE POLICY "Anyone can view categories" ON categories
FOR SELECT USING (true);

-- Users: Can view own profile, admins can view all
CREATE POLICY "Users can view own profile" ON users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
FOR INSERT WITH CHECK (auth.uid() = id);

-- Products: Anyone can view active, manufacturers manage their own
CREATE POLICY "Anyone can view active products" ON products
FOR SELECT USING (is_active = true);

CREATE POLICY "Manufacturers can view own products" ON products
FOR SELECT USING (manufacturer_id = auth.uid());

CREATE POLICY "Manufacturers can insert products" ON products
FOR INSERT WITH CHECK (manufacturer_id = auth.uid());

CREATE POLICY "Manufacturers can update own products" ON products
FOR UPDATE USING (manufacturer_id = auth.uid());

-- Orders: Users can view their own orders
CREATE POLICY "Retailers can view own orders" ON orders
FOR SELECT USING (retailer_id = auth.uid());

CREATE POLICY "Manufacturers can view orders for their products" ON orders
FOR SELECT USING (manufacturer_id = auth.uid());

CREATE POLICY "Retailers can create orders" ON orders
FOR INSERT WITH CHECK (retailer_id = auth.uid());

CREATE POLICY "Manufacturers can update order status" ON orders
FOR UPDATE USING (manufacturer_id = auth.uid());

-- Payouts: Manufacturers can view their payouts
CREATE POLICY "Manufacturers can view own payouts" ON payouts
FOR SELECT USING (manufacturer_id = auth.uid());

-- =============================================
-- DONE! Your database is ready.
-- =============================================
