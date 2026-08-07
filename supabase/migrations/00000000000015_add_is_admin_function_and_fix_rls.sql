-- Migration 15: Create SECURITY DEFINER is_admin() function and fix RLS recursion
-- Prevents RLS policy recursion on profiles and admin_users tables.

-- 1. Create SECURITY DEFINER helper function with fixed search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager') AND account_status IN ('active', 'trial')
  );
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Update profiles policies to use is_admin() helper
DROP POLICY IF EXISTS "Admins and managers can select all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins and managers can select all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin() OR id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin());

-- 3. Update catalogue_versions and catalogue_items policies to use is_admin()
DROP POLICY IF EXISTS "Allow admins to select catalogue_versions" ON public.catalogue_versions;
DROP POLICY IF EXISTS "Allow admins to insert catalogue_versions" ON public.catalogue_versions;
DROP POLICY IF EXISTS "Allow admins to select catalogue_items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Allow admins to insert catalogue_items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Allow admins to update catalogue_items" ON public.catalogue_items;

CREATE POLICY "Allow admins to select catalogue_versions"
  ON public.catalogue_versions FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow admins to insert catalogue_versions"
  ON public.catalogue_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow admins to update catalogue_versions"
  ON public.catalogue_versions FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow admins to select catalogue_items"
  ON public.catalogue_items FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow admins to insert catalogue_items"
  ON public.catalogue_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow admins to update catalogue_items"
  ON public.catalogue_items FOR UPDATE TO authenticated
  USING (public.is_admin());
