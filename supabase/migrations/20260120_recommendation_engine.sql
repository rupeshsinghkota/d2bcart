-- 1. Create User Interactions Table
create table if not exists user_interactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null, -- Optional (for logged in)
  session_id text, -- Optional (for guests / cookies)
  product_id uuid references products(id) on delete cascade not null,
  interaction_type text not null check (interaction_type in ('view', 'time_spent', 'add_to_cart', 'order')),
  value numeric default 1, -- Seconds for time_spent, Quantity for order, 1 for others
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Performance Indexes
create index if not exists idx_interactions_product on user_interactions(product_id);
create index if not exists idx_interactions_user on user_interactions(user_id);
create index if not exists idx_interactions_session on user_interactions(session_id);
create index if not exists idx_interactions_created_at on user_interactions(created_at);

-- 3. RLS Policies (Enable security)
alter table user_interactions enable row level security;

-- Allow anyone (including guests) to insert interactions
create policy "Enable insert for everyone" on user_interactions
  for insert with check (true);

-- Allow users to read only their own interactions (optional, for history)
create policy "Users can read own interactions" on user_interactions
  for select using (
    (auth.uid() = user_id) or (session_id = current_setting('request.headers')::json->>'x-session-id')
  );


-- 4. Algorithm Function: Get Ranked Products
-- This function calculates a score for products within a category based on interactions
create or replace function get_ranked_products(
  target_category_id uuid,
  limit_count int default 20,
  offset_count int default 0
)
returns table (
  id uuid,
  name text,
  base_price numeric,
  display_price numeric,
  images text[],
  moq numeric,
  stock numeric,
  score numeric
)
language plpgsql
as $$
begin
  return query
  with product_scores as (
    select
      p.id as pid,
      -- Score Calculation Logic
      (
        (count(distinct case when ui.interaction_type = 'view' then ui.session_id end) * 1) + -- 1 point per unique view
        (sum(case when ui.interaction_type = 'time_spent' then ui.value else 0 end) * 0.1) + -- 0.1 point per second viewed
        (count(case when ui.interaction_type = 'add_to_cart' then 1 end) * 5) + -- 5 points per add to cart
        (count(case when ui.interaction_type = 'order' then 1 end) * 20) -- 20 points per order
      ) as relevance_score
    from
      products p
    left join
      user_interactions ui on p.id = ui.product_id
    where
      p.is_active = true
      and p.stock > 0
      and (target_category_id is null or p.category_id = target_category_id)
      -- Optional: Time decay (only count last 30 days)
      -- and (ui.created_at > now() - interval '30 days' or ui.created_at is null)
    group by
      p.id
  )
  select
    p.id,
    p.name,
    p.base_price,
    p.display_price,
    p.images,
    p.moq,
    p.stock,
    coalesce(ps.relevance_score, 0) as score
  from
    products p
  left join
    product_scores ps on p.id = ps.pid
  where
    p.is_active = true
    and (target_category_id is null or p.category_id = target_category_id)
  order by
    score desc, -- Primary sort by algorithm
    p.created_at desc -- Fallback to newest
  limit
    limit_count
  offset
    offset_count;
end;
$$;
