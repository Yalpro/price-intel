-- Migration: 00000000000007_fix_profiles_rls.sql
-- Purpose: Fix infinite recursion (42P17) in profiles RLS policies

-- 1. Create a SECURITY DEFINER helper function to safely check admin/manager role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  );
$$;

-- 2. Drop existing recursive SELECT policies on profiles
DROP POLICY IF EXISTS "Admins and managers can select all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can select own profile" ON profiles;

-- 3. Re-create clean, non-recursive SELECT policies
-- Direct check for own profile (evaluated without subquery)
CREATE POLICY "Users can select own profile"
ON profiles FOR SELECT TO authenticated
USING (id = auth.uid());

-- Admin/Manager override using SECURITY DEFINER function
CREATE POLICY "Admins and managers can select all profiles"
ON profiles FOR SELECT TO authenticated
USING (public.is_admin_or_manager());
