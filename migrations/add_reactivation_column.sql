-- Add column to track when the reactivation message was sent
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS reactivation_sent_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance on frequent lookups
CREATE INDEX IF NOT EXISTS idx_users_reactivation_null 
ON public.users(created_at) 
WHERE reactivation_sent_at IS NULL;
