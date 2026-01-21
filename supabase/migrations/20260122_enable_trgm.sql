-- Enable the pg_trgm extension for fuzzy string matching
create extension if not exists pg_trgm with schema extensions;

-- Create GIN indexes on name and description for fast fuzzy searching
-- These utilize the trigram operator classes to speed up LIKE and ILIKE and % (similarity) queries
create index if not exists products_name_trgm_idx on products using gin (name gin_trgm_ops);
create index if not exists products_description_trgm_idx on products using gin (description gin_trgm_ops);
create index if not exists products_smart_tags_trgm_idx on products using gin (smart_tags);

-- Function to get instant search suggestions
-- Returns a mix of highly relevant products, matching categories, and brands
create or replace function get_instant_search_results(
  search_query text,
  max_results int default 5
)
returns json
language plpgsql
security definer
as $$
declare
  matching_products json;
  matching_categories json;
  result json;
begin
  -- 1. Get exact prefix matches or strong trigram matches for Products
  select json_agg(p) into matching_products
  from (
    select 
      id, 
      name, 
      slug, 
      images->0 as image,
      display_price as price,
      parent_id
    from products
    where 
      is_active = true 
      and (
        name ilike search_query || '%' -- Prefix match (Highest priority)
        or 
        name % search_query            -- Fuzzy match (Trigram)
      )
    order by 
      case 
        when name ilike search_query || '%' then 1 
        else 2 
      end,
      similarity(name, search_query) desc
    limit max_results
  ) p;

  -- 2. Get matching Categories
  select json_agg(c) into matching_categories
  from (
    select name, slug
    from categories
    where 
      name ilike search_query || '%'
    limit 3
  ) c;

  -- Combine results
  result := json_build_object(
    'products', coalesce(matching_products, '[]'::json),
    'categories', coalesce(matching_categories, '[]'::json)
  );

  return result;
end;
$$;
