/*
  # Fix RLS Policies for Products and Storage

  This migration fixes Row-Level Security policies to ensure users can properly
  manage their own products and associated images.

  ## Changes Made

  1. **Products Table RLS**
     - Enable RLS on products table
     - Ensure proper policies for CRUD operations on user's own products

  2. **Product Images Table RLS** 
     - Ensure users can manage images for their own products
     - Fix policies to check product ownership

  3. **Storage Policies**
     - Add policies for the public bucket with user-specific paths
     - Allow authenticated users to manage files in their own folders

  ## Security
  - All policies ensure users can only access their own data
  - Storage policies include user ID in path for additional security
*/

-- Enable RLS on products table (if not already enabled)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Users can manage own products" ON public.products;
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;

-- Create comprehensive policies for products table
CREATE POLICY "Users can view own products" ON public.products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" ON public.products
  FOR DELETE USING (auth.uid() = user_id);

-- Ensure RLS is enabled on product_images table
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies for product_images if they exist
DROP POLICY IF EXISTS "Users can manage own product images" ON public.product_images;
DROP POLICY IF EXISTS "Users can view images of own products" ON public.product_images;
DROP POLICY IF EXISTS "Users can insert images for own products" ON public.product_images;
DROP POLICY IF EXISTS "Users can update images of own products" ON public.product_images;
DROP POLICY IF EXISTS "Users can delete images of own products" ON public.product_images;

-- Create comprehensive policies for product_images table
CREATE POLICY "Users can view images of own products" ON public.product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert images for own products" ON public.product_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update images of own products" ON public.product_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images of own products" ON public.product_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

-- Storage policies for the public bucket
-- Note: These policies allow users to manage files in their own user-specific folders

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete product images" ON storage.objects;

-- Create storage policies with user-specific path restrictions
CREATE POLICY "Allow authenticated users to upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'public' 
    AND (storage.foldername(name))[1] = 'product'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated users to view product images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'public' 
    AND (storage.foldername(name))[1] = 'product'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated users to update product images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'public' 
    AND (storage.foldername(name))[1] = 'product'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated users to delete product images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'public' 
    AND (storage.foldername(name))[1] = 'product'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND auth.role() = 'authenticated'
  );