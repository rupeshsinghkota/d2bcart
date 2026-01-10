-- 1. Enable the pg_trgm extension (Required for Trigram similarity search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create a GIN Index on the Product Name using Trigram Operations
-- This makes "name ILIKE '%query%'" extremely fast
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING GIN (name gin_trgm_ops);

-- 3. (Optional) You can also index description if you want deep fallbacks, 
-- but usually just Name is enough for the "1+" fallback case.
-- CREATE INDEX IF NOT EXISTS products_description_trgm_idx ON products USING GIN (description gin_trgm_ops);
