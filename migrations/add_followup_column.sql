-- Add column to track when the follow-up message was sent
ALTER TABLE public.catalog_downloads 
ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance on frequent lookups
CREATE INDEX IF NOT EXISTS idx_catalog_downloads_followup_null 
ON public.catalog_downloads(created_at) 
WHERE followup_sent_at IS NULL;
