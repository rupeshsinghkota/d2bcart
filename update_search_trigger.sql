-- 1. Update the Main Search Trigger to include Child Variations
CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
DECLARE
  child_text text;
BEGIN
  -- If this is a parent product (parent_id is null), fetch text from all its children
  IF new.parent_id IS NULL THEN
    SELECT string_agg(coalesce(name, '') || ' ' || coalesce(sku, ''), ' ')
    INTO child_text
    FROM products
    WHERE parent_id = new.id AND is_active = true;
  END IF;

  -- Build the search vector: 
  -- A: Parent Name
  -- B: Parent SKU + Child Variations Text (Names & SKUs)
  -- C: Parent Description
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.sku, '') || ' ' || coalesce(child_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');

  return new;
end
$$ LANGUAGE plpgsql;

-- 2. Create the Propagator Trigger Function
CREATE OR REPLACE FUNCTION propagate_child_update_to_parent() RETURNS trigger AS $$
BEGIN
  -- If a child is changed, "touch" the parent to force its search_trigger to run again
  -- We update 'search_vector' to NULL to trigger the update without changing schema
  IF (TG_OP = 'DELETE') THEN
    IF OLD.parent_id IS NOT NULL THEN
        UPDATE products SET search_vector = NULL WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.parent_id IS NOT NULL THEN
        UPDATE products SET search_vector = NULL WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
  END IF;
END
$$ LANGUAGE plpgsql;

-- 3. Attach the Propagator Trigger
DROP TRIGGER IF EXISTS child_product_update_trigger ON products;
CREATE TRIGGER child_product_update_trigger
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE PROCEDURE propagate_child_update_to_parent();

-- 4. FORCE RE-INDEX of all Parents immediately (Trigger the search_vector update)
UPDATE products SET search_vector = NULL WHERE parent_id IS NULL;
