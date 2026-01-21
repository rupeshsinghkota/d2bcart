-- Add attribution columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS gclid text,
ADD COLUMN IF NOT EXISTS fbclid text,
ADD COLUMN IF NOT EXISTS attribution_data jsonb;

-- Create an index to help with reporting later
CREATE INDEX IF NOT EXISTS idx_orders_utm_source ON orders(utm_source);
CREATE INDEX IF NOT EXISTS idx_orders_gclid ON orders(gclid);
