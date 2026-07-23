-- Migration: 00000000000005_unified_profiles.sql
-- Purpose: Unified SaaS Role System, Retailer Profiles, and Retailer Specific Tables

-- 1. Create the unified profiles table
CREATE TABLE profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  role text not null check (role in ('admin', 'manager', 'retailer')),
  account_status text not null check (account_status in ('pending', 'trial', 'active', 'expired', 'suspended')) default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Migrate existing admin_users into profiles (Safe Migration)
-- We insert admins into profiles. We set status to active.
INSERT INTO profiles (id, role, account_status)
SELECT user_id, 'admin', 'active'
FROM admin_users
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- 3. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Admins and managers can read all profiles. Retailers can only read their own profile.
CREATE POLICY "Admins and managers can select all profiles"
ON profiles FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles p WHERE p.id = auth.uid()) IN ('admin', 'manager')
);

CREATE POLICY "Users can select own profile"
ON profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile fields"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  -- Prevent users from escalating their own role or changing their own status
  role = (SELECT role FROM profiles WHERE id = auth.uid()) 
  AND account_status = (SELECT account_status FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
);

-- 4. Update Existing Admin Policies to use `profiles` instead of `admin_users`

-- Suppliers
DROP POLICY IF EXISTS "Allow admins to select suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow admins to insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow admins to update suppliers" ON suppliers;

CREATE POLICY "Allow admins to select suppliers" ON suppliers FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to insert suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to update suppliers" ON suppliers FOR UPDATE TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Raw Products
DROP POLICY IF EXISTS "Allow admins to select raw_products" ON raw_products;
DROP POLICY IF EXISTS "Allow admins to update raw_products" ON raw_products;

CREATE POLICY "Allow admins to select raw_products" ON raw_products FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to update raw_products" ON raw_products FOR UPDATE TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Canonical Products (Retailers will need select access later via secure views, but for now base table restricts to admin for raw read)
DROP POLICY IF EXISTS "Allow admins to select canonical_products" ON canonical_products;
DROP POLICY IF EXISTS "Allow admins to insert canonical_products" ON canonical_products;
DROP POLICY IF EXISTS "Allow admins to update canonical_products" ON canonical_products;

CREATE POLICY "Allow admins to select canonical_products" ON canonical_products FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to insert canonical_products" ON canonical_products FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to update canonical_products" ON canonical_products FOR UPDATE TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Product Mappings
DROP POLICY IF EXISTS "Allow admins to select product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Allow admins to update product_mappings" ON product_mappings;

CREATE POLICY "Allow admins to select product_mappings" ON product_mappings FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to update product_mappings" ON product_mappings FOR UPDATE TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Price Snapshots
DROP POLICY IF EXISTS "Allow admins to select price_snapshots" ON price_snapshots;
CREATE POLICY "Allow admins to select price_snapshots" ON price_snapshots FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Subscribers
DROP POLICY IF EXISTS "Allow admins to select subscribers" ON subscribers;
DROP POLICY IF EXISTS "Allow admins to insert subscribers" ON subscribers;
DROP POLICY IF EXISTS "Allow admins to update subscribers" ON subscribers;

CREATE POLICY "Allow admins to select subscribers" ON subscribers FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to insert subscribers" ON subscribers FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to update subscribers" ON subscribers FOR UPDATE TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Scraper Runs
DROP POLICY IF EXISTS "Allow admins to select scraper_runs" ON scraper_runs;
CREATE POLICY "Allow admins to select scraper_runs" ON scraper_runs FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Product Search Logs
DROP POLICY IF EXISTS "Allow admins to select product_search_logs" ON product_search_logs;
CREATE POLICY "Allow admins to select product_search_logs" ON product_search_logs FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- Catalogue Versions & Items
DROP POLICY IF EXISTS "Allow admins to select catalogue_versions" ON catalogue_versions;
DROP POLICY IF EXISTS "Allow admins to insert catalogue_versions" ON catalogue_versions;
DROP POLICY IF EXISTS "Allow admins to select catalogue_items" ON catalogue_items;
DROP POLICY IF EXISTS "Allow admins to insert catalogue_items" ON catalogue_items;
DROP POLICY IF EXISTS "Allow admins to update catalogue_items" ON catalogue_items;

CREATE POLICY "Allow admins to select catalogue_versions" ON catalogue_versions FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to insert catalogue_versions" ON catalogue_versions FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Allow admins to select catalogue_items" ON catalogue_items FOR SELECT TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to insert catalogue_items" ON catalogue_items FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Allow admins to update catalogue_items" ON catalogue_items FOR UPDATE TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

-- 5. Drop the old `admin_users` table
DROP TABLE IF EXISTS admin_users CASCADE;

-- 6. Create Retailer-specific operational tables
CREATE TABLE saved_products (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  canonical_product_id bigint references canonical_products(id) on delete cascade not null,
  saved_at timestamptz default now(),
  unique (user_id, canonical_product_id)
);

CREATE TABLE price_alerts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  canonical_product_id bigint references canonical_products(id) on delete cascade not null,
  alert_type text not null check (alert_type in ('below_target', 'percentage_drop', 'new_promotion', 'supplier_cheapest', 'back_in_stock')),
  target_value numeric,
  notification_channel text default 'in_app',
  active boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS for Retailer tables
ALTER TABLE saved_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retailers can select own saved_products" ON saved_products FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Retailers can insert own saved_products" ON saved_products FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Retailers can delete own saved_products" ON saved_products FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Retailers can select own price_alerts" ON price_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Retailers can insert own price_alerts" ON price_alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Retailers can update own price_alerts" ON price_alerts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Retailers can delete own price_alerts" ON price_alerts FOR DELETE TO authenticated USING (user_id = auth.uid());
