-- Add AI Refinement Columns to Products Table

alter table products 
add column if not exists smart_tags text[] default '{}',
add column if not exists ai_metadata jsonb default '{}'::jsonb;

-- Add index for smart_tags to general search vector (optional, but good for future)
-- We will append these tags to the search_vector trigger if we want them searchable.
-- For now, let's just create the columns.
