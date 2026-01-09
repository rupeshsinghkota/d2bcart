-- Create the 'catalogs' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('catalogs', 'catalogs', true)
on conflict (id) do nothing;

-- Set up security policies for the 'catalogs' bucket

-- 1. Allow Public Read Access (Everyone can download)
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'catalogs' );

-- 2. Allow Authenticated Users (e.g., Cron/Admin) to Upload
create policy "Authenticated Upload"
  on storage.objects for insert
  with check ( bucket_id = 'catalogs' and auth.role() = 'authenticated' );

-- 3. Allow Updates
create policy "Authenticated Update"
  on storage.objects for update
  using ( bucket_id = 'catalogs' and auth.role() = 'authenticated' );
