-- Manual Storage Policies Setup for Inventory Images
-- Run these commands in the Supabase SQL Editor or Dashboard

-- First, ensure the bucket exists (run the migration first)
-- Then run these policies:

-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload inventory images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inventory-images');

-- Allow authenticated users to view images
CREATE POLICY "Allow authenticated users to view inventory images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'inventory-images');

-- Allow authenticated users to update images
CREATE POLICY "Allow authenticated users to update inventory images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'inventory-images');

-- Allow authenticated users to delete images
CREATE POLICY "Allow authenticated users to delete inventory images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'inventory-images');

-- Alternative: If you want public access to view images (for public bucket)
-- CREATE POLICY "Allow public access to view inventory images"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'inventory-images');
