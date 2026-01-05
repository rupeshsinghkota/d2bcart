-- Remove unique constraint from order_number because we now use the same Order # for multiple product rows (1 row per product)
-- This allows grouping items by Order # in the UI while maintaining row-level granularity for products
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

-- Verify/Safety: Ensure there is still an index on order_number for performance (optional but good practice)
-- CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
