-- Function to efficiently sync category prices in bulk
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION sync_category_prices(target_category_id UUID, markup_percentage NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update prices for all products in the category
    -- Logic: display_price = ROUND(base_price * (1 + markup/100))
    -- Logic: your_margin = display_price - base_price
    
    WITH updates AS (
        UPDATE products
        SET 
            display_price = ROUND(base_price * (1 + markup_percentage / 100)),
            your_margin = ROUND(base_price * (1 + markup_percentage / 100)) - base_price
        WHERE category_id = target_category_id
        AND base_price IS NOT NULL
        RETURNING 1
    )
    SELECT COUNT(*) INTO updated_count FROM updates;
    
    RETURN updated_count;
END;
$$;
