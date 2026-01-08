-- Create table for storing cached catalog references
CREATE TABLE IF NOT EXISTS category_catalogs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE UNIQUE,
    pdf_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE category_catalogs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read the cache (to check if it exists or to download)
CREATE POLICY "Allow public read access" ON category_catalogs
    FOR SELECT USING (true);

-- Only authenticated users (or service role) can insert/update (logic handled by API)
-- In this app, the API uses the user's session, so we allow auth users to update it via the API logic
CREATE POLICY "Allow authenticated insert/update" ON category_catalogs
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger to update updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON category_catalogs
    FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- STORAGE BUCKET SETUP (Ideally run in Supabase Dashboard, but SQL can attempt it)
-- Note: Creating buckets via SQL varies by Supabase version/extensions. 
-- We assume the 'catalogs' bucket will be created. 
-- Below is for Reference/Documentation or if pg_net/storage extensions are enabled.
-- It's safer to ask the user to ensure 'catalogs' bucket exists.

-- Policy for Storage (virtual table 'storage.objects')
-- We need public read access for the files in 'catalogs' bucket
-- This must be run in the Storage SQL Editor usually, but here is the logic:
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'catalogs' );
-- CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'catalogs' AND auth.role() = 'authenticated' );
