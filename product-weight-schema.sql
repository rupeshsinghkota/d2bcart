-- Add weight column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,2) DEFAULT 0.5;
