-- Migration: Add smart_tags and extract AI metadata to search_vector
-- File: supabase/migrations/20260121_update_search_vector_tags.sql

create or replace function products_search_vector_update()
returns trigger as $$
declare
  -- Extract fields safely from JSONB if they exist
  meta_brand text := coalesce(new.ai_metadata->>'brand', '');
  meta_model text := coalesce(new.ai_metadata->>'model', '');
  meta_type text := coalesce(new.ai_metadata->>'type', '');
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', meta_brand), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(new.smart_tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', meta_model), 'C') ||
    setweight(to_tsvector('english', meta_type), 'C') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_search_update on products;

create trigger products_search_update
before insert or update on products
for each row
execute function products_search_vector_update();

-- Update existing products (Force re-calc)
update products 
set search_vector = 
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(ai_metadata->>'brand', '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(smart_tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(ai_metadata->>'model', '')), 'C') ||
    setweight(to_tsvector('english', coalesce(ai_metadata->>'type', '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D');
