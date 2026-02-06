-- Sourcing Agent v2: Enhanced Supplier Tracking Columns
-- Run this in Supabase SQL Editor

-- Add new columns for enhanced tracking (each column needs separate statement)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_quoted_price DECIMAL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_moq INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS products_discussed TEXT[] DEFAULT '{}';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS negotiation_stage TEXT DEFAULT 'initial';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deal_score INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS conversation_summary TEXT;

-- Index for follow-up queries
CREATE INDEX IF NOT EXISTS idx_suppliers_followup 
ON suppliers (last_contacted_at, is_verified, follow_up_count);

-- Index for deal scoring
CREATE INDEX IF NOT EXISTS idx_suppliers_deal_score 
ON suppliers (deal_score DESC);
