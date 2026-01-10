-- 1. Add the search column (tsvector)
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Create an index for lightning-fast search (GIN Index)
CREATE INDEX IF NOT EXISTS products_search_idx ON products USING GIN (search_vector);

-- 3. Update existing rows with weighted search terms
-- Weight A (Highest): Product Name
-- Weight B (High): SKU
-- Weight C (Normal): Description
UPDATE products 
SET search_vector = 
    setweight(to_tsvector('english', coalesce(name, '')), 'A') || 
    setweight(to_tsvector('english', coalesce(sku, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C');

-- 4. Create a function to automatically update the search vector on changes
CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.sku, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  return new;
end
$$ LANGUAGE plpgsql;

-- 5. Attach the trigger to the products table
DROP TRIGGER IF EXISTS tsvectorupdate ON products;
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON products FOR EACH ROW EXECUTE PROCEDURE products_search_trigger();
