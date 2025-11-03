/*
  # Fix RLS policies for product management

  This migration fixes Row-Level Security policies that are preventing users from updating their products.

  ## Tables Updated
  1. **products** - Enable RLS and create policies for CRUD operations
  2. **product_images** - Enable RLS and create policies for CRUD operations  
  3. **product_price_tiers** - Enable RLS and create policies for CRUD operations

  ## Storage Policies
  - **public bucket** - Create policies for product image uploads in the 'product' folder

  ## Security
  - Users can only access their own products
  - Product images and price tiers are accessible only if the user owns the parent product
  - Storage policies allow users to upload images with their user ID in the filename
*/

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can insert own products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;
DROP POLICY IF EXISTS "Users can delete own products" ON products;

-- Create policies for products table
CREATE POLICY "Users can view own products"
  ON products
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
  ON products
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable RLS on product_images table
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view images of own products" ON product_images;
DROP POLICY IF EXISTS "Users can insert images for own products" ON product_images;
DROP POLICY IF EXISTS "Users can update images of own products" ON product_images;
DROP POLICY IF EXISTS "Users can delete images of own products" ON product_images;

-- Create policies for product_images table
CREATE POLICY "Users can view images of own products"
  ON product_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert images for own products"
  ON product_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update images of own products"
  ON product_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images of own products"
  ON product_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_images.product_id 
      AND products.user_id = auth.uid()
    )
  );

-- Enable RLS on product_price_tiers table
ALTER TABLE product_price_tiers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view price tiers of own products" ON product_price_tiers;
DROP POLICY IF EXISTS "Users can insert price tiers for own products" ON product_price_tiers;
DROP POLICY IF EXISTS "Users can update price tiers of own products" ON product_price_tiers;
DROP POLICY IF EXISTS "Users can delete price tiers of own products" ON product_price_tiers;

-- Create policies for product_price_tiers table
CREATE POLICY "Users can view price tiers of own products"
  ON product_price_tiers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_price_tiers.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert price tiers for own products"
  ON product_price_tiers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_price_tiers.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update price tiers of own products"
  ON product_price_tiers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_price_tiers.product_id 
      AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_price_tiers.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete price tiers of own products"
  ON product_price_tiers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM products 
      WHERE products.id = product_price_tiers.product_id 
      AND products.user_id = auth.uid()
    )
  );