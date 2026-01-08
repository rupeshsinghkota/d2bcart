-- Create table for tracking catalog downloads
create table if not exists catalog_downloads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  category_id text not null,
  source_page text not null, -- 'category' or 'product'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table catalog_downloads enable row level security;

-- Policies
create policy "Users can view their own downloads"
  on catalog_downloads for select
  using (auth.uid() = user_id);

create policy "Users can insert their own downloads"
  on catalog_downloads for insert
  with check (auth.uid() = user_id);

-- Optional: Allow admins to view all (if needed later)
-- create policy "Admins can view all downloads" ...
