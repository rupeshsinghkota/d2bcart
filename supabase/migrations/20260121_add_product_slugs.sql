-- Add slug column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;

-- Create a function to generate slugs
CREATE OR REPLACE FUNCTION generate_slug(name text, id text) RETURNS text AS $$
BEGIN
  -- Basic slug generation: lowercase, replace non-alphanumeric with dash, trim
  -- We obey the rule: name-id to ensure uniqueness easily for backfill
  RETURN lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || id;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing products
UPDATE products 
SET slug = generate_slug(name, id::text)
WHERE slug IS NULL;

-- Make slug column not null after backfill
ALTER TABLE products ALTER COLUMN slug SET NOT NULL;

-- Add unique constraint
ALTER TABLE products ADD CONSTRAINT products_slug_key UNIQUE (slug);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
