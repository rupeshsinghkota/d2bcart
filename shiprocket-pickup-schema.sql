-- Add Shiprocket pickup code to users table (for manufacturers)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS shiprocket_pickup_code text;
