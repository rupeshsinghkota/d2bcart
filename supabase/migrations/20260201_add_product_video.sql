-- 1. Add video_url column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 2. Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for 'videos' bucket
-- Allow anyone to view videos (public read)
CREATE POLICY "Public Video Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'videos' );

-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated Video Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'videos' );

-- Allow users to delete their own videos
CREATE POLICY "Authenticated Video Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'videos' );
