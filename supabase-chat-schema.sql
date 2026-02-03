-- =============================================
-- D2BCART CHAT HISTORY & IDEMPOTENCY
-- Run this in Supabase SQL Editor to enable Chat Memory & Stop Looping
-- =============================================

CREATE TABLE IF NOT EXISTS whatsapp_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mobile TEXT NOT NULL,
    message TEXT,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    msg_id TEXT, -- MSG91 Message UUID or Request ID
    status TEXT DEFAULT 'sent',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup based on mobile (for history) and caching
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_mobile ON whatsapp_chats(mobile);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_created_at ON whatsapp_chats(created_at);

-- RLS (Optional, but good practice)
ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all chats" ON whatsapp_chats
FOR SELECT USING (true); -- Simplified for admin use
