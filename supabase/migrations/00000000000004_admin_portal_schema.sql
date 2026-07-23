-- Admin Portal Schema Migration

-- 1. Create Admin Users Allow-list
CREATE TABLE admin_users (
  user_id uuid references auth.users(id) primary key,
  role text default 'admin',
  added_at timestamptz default now()
);

-- Enable RLS on admin_users (Only admins can view/manage other admins, plus service role)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins to select admin_users" 
ON admin_users FOR SELECT TO authenticated 
USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- (Initial seed requires service role or manual DB intervention, which is standard for first admin)

-- 2. Create Catalogue Versioning Tables
CREATE TABLE catalogue_versions (
  id bigint generated always as identity primary key,
  version_name text not null, -- e.g., "August 2026 Top 1000"
  imported_by uuid references auth.users(id),
  imported_at timestamptz default now()
);

CREATE TABLE catalogue_items (
  id bigint generated always as identity primary key,
  version_id bigint not null references catalogue_versions(id) on delete cascade,
  barcode text not null,
  name text not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Indexes for performance
CREATE INDEX idx_catalogue_items_version ON catalogue_items(version_id);
CREATE INDEX idx_catalogue_items_barcode ON catalogue_items(barcode);

-- Enable RLS
ALTER TABLE catalogue_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_items ENABLE ROW LEVEL SECURITY;

-- Policies for Catalogue
CREATE POLICY "Allow admins to select catalogue_versions" 
ON catalogue_versions FOR SELECT TO authenticated 
USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "Allow admins to insert catalogue_versions" 
ON catalogue_versions FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "Allow admins to select catalogue_items" 
ON catalogue_items FOR SELECT TO authenticated 
USING (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "Allow admins to insert catalogue_items" 
ON catalogue_items FOR INSERT TO authenticated 
WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

CREATE POLICY "Allow admins to update catalogue_items" 
ON catalogue_items FOR UPDATE TO authenticated 
USING (auth.uid() IN (SELECT user_id FROM admin_users));


-- 3. Update existing RLS policies to restrict to `admin_users` instead of just `authenticated`
-- (The previous policies used `TO authenticated USING (true)`, which we will drop and recreate)

-- Suppliers
DROP POLICY IF EXISTS "Allow authenticated admins to select suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow authenticated admins to insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow authenticated admins to update suppliers" ON suppliers;

CREATE POLICY "Allow admins to select suppliers" ON suppliers FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to insert suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to update suppliers" ON suppliers FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Raw Products
DROP POLICY IF EXISTS "Allow authenticated admins to select raw_products" ON raw_products;
DROP POLICY IF EXISTS "Allow authenticated admins to update raw_products" ON raw_products;

CREATE POLICY "Allow admins to select raw_products" ON raw_products FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to update raw_products" ON raw_products FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Canonical Products
DROP POLICY IF EXISTS "Allow authenticated admins to select canonical_products" ON canonical_products;
DROP POLICY IF EXISTS "Allow authenticated admins to insert canonical_products" ON canonical_products;
DROP POLICY IF EXISTS "Allow authenticated admins to update canonical_products" ON canonical_products;

CREATE POLICY "Allow admins to select canonical_products" ON canonical_products FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to insert canonical_products" ON canonical_products FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to update canonical_products" ON canonical_products FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Product Mappings
DROP POLICY IF EXISTS "Allow authenticated admins to select product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Allow authenticated admins to update product_mappings" ON product_mappings;

CREATE POLICY "Allow admins to select product_mappings" ON product_mappings FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to update product_mappings" ON product_mappings FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Price Snapshots
DROP POLICY IF EXISTS "Allow authenticated admins to select price_snapshots" ON price_snapshots;

CREATE POLICY "Allow admins to select price_snapshots" ON price_snapshots FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Subscribers
DROP POLICY IF EXISTS "Allow authenticated admins to select subscribers" ON subscribers;
DROP POLICY IF EXISTS "Allow authenticated admins to insert subscribers" ON subscribers;
DROP POLICY IF EXISTS "Allow authenticated admins to update subscribers" ON subscribers;

CREATE POLICY "Allow admins to select subscribers" ON subscribers FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to insert subscribers" ON subscribers FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Allow admins to update subscribers" ON subscribers FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Scraper Runs
DROP POLICY IF EXISTS "Allow authenticated admins to select scraper_runs" ON scraper_runs;

CREATE POLICY "Allow admins to select scraper_runs" ON scraper_runs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Product Search Logs
-- (No previous policy was defined for authenticated, so we create one)
CREATE POLICY "Allow admins to select product_search_logs" ON product_search_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM admin_users));
