-- =============================================
-- MIGRATION: Add missing columns to products table
-- Run this in Supabase SQL Editor
-- =============================================

-- Add SKU column (for WooCommerce product identification)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;

-- Add parent_id for product variations
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES products(id);

-- Add product type (simple, variable, variation)
ALTER TABLE products ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'simple';

-- Add physical dimensions for shipping
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS length DECIMAL(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS breadth DECIMAL(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS height DECIMAL(10,2) DEFAULT 0;

-- Add tax information
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 18;

-- Create index on SKU for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Create index on parent_id for variation queries
CREATE INDEX IF NOT EXISTS idx_products_parent_id ON products(parent_id);
