-- Add SKU and Parent ID columns to support variants and WooCommerce import
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES products(id),
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'simple';

-- Create an index for faster SKU lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
-- Create an index for faster parent lookup
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_id);
