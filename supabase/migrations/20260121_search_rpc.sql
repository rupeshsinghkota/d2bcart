-- Function to search products with ranking (Relevance Sort)
-- Matches ANY term (OR logic) but orders by how well it matches (ts_rank)
-- This implements the "Maximum combination then decrease" logic

create or replace function search_products_ranked(
  search_query text,
  limit_count int,
  offset_count int
) returns setof products as $$
begin
  return query
  select *
  from products
  where 
    is_active = true 
    and parent_id is null
    and search_vector @@ to_tsquery('english', search_query)
  order by 
    ts_rank(search_vector, to_tsquery('english', search_query)) desc,
    created_at desc
  limit limit_count
  offset offset_count;
end;
$$ language plpgsql;
