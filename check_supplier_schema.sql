-- =============================================
-- SUPPLIER SOURCING SCHEMA
-- Stores discovered suppliers and their products found by AI
-- =============================================

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL, -- Normalized format (e.g., 919876543210)
    category TEXT,       -- e.g., "Mobile Covers", "Electronics"
    status TEXT DEFAULT 'discovered', -- discovered, contacted, responded, negotiated, rejected
    rating FLOAT,        -- 1-5 stars aimed by AI or Manual
    website TEXT,
    email TEXT,
    location TEXT,
    notes TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by phone (to link with whatsapp_chats)
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);

-- 2. Supplier Products Table (Catalog items found)
CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_range TEXT,    -- Store as text initially e.g. "100-150"
    moq TEXT,            -- Minimum Order Quantity e.g. "50 pcs"
    image_url TEXT,
    source_url TEXT,     -- Where this was found (if web search)
    metadata JSONB,      -- Extra details like specs, colors
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update Chat History to distinguish flows
-- We can add a simple check column or use existing metadata.
-- For now, let's ensure we can query by 'intent' or 'bot_type' if needed.
-- Adding a comment here: 'whatsapp_chats' table will use metadata->>'full_context' = 'sourcing' 

-- 4. RLS for Suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all suppliers" ON suppliers FOR SELECT USING (true);
CREATE POLICY "Admins can insert suppliers" ON suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update suppliers" ON suppliers FOR UPDATE USING (true);

ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all supplier products" ON supplier_products FOR SELECT USING (true);
