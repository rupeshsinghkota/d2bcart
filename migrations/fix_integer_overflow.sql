-- Fix Integer Overflow Issue
-- Run this in Supabase SQL Editor

-- The error "value X is out of range for type integer" indicates
-- that some price/amount columns may be INTEGER instead of DECIMAL.
-- This migration changes them to NUMERIC (supports much larger values).

-- Check and alter products table columns if they are INTEGER
ALTER TABLE products
    ALTER COLUMN base_price TYPE NUMERIC(15,2) USING base_price::NUMERIC(15,2),
    ALTER COLUMN display_price TYPE NUMERIC(15,2) USING display_price::NUMERIC(15,2),
    ALTER COLUMN your_margin TYPE NUMERIC(15,2) USING your_margin::NUMERIC(15,2);

-- Also fix stock if it's causing issues with very large values
ALTER TABLE products
    ALTER COLUMN stock TYPE BIGINT USING stock::BIGINT;
