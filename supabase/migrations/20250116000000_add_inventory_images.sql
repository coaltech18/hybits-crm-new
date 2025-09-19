-- Add image support to inventory items
-- This migration adds image URL fields to the inventory_items table

-- Add image fields to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN image_url TEXT,
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN image_alt_text TEXT;

-- Add index for better performance when filtering by items with/without images
CREATE INDEX idx_inventory_items_has_image ON public.inventory_items(image_url) WHERE image_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.inventory_items.image_url IS 'URL to the main image of the inventory item stored in Supabase Storage';
COMMENT ON COLUMN public.inventory_items.thumbnail_url IS 'URL to the thumbnail version of the image for faster loading';
COMMENT ON COLUMN public.inventory_items.image_alt_text IS 'Alt text for accessibility and SEO purposes';
