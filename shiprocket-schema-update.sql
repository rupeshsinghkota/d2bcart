-- Add Shiprocket implementation columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipment_id text,
ADD COLUMN IF NOT EXISTS awb_code text,
ADD COLUMN IF NOT EXISTS courier_name text,
ADD COLUMN IF NOT EXISTS shipping_label_url text;
