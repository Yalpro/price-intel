-- Migration 14: Add is_active flag and partial unique index to catalogue_versions table
-- Guarantees at the database level that AT MOST ONE catalogue version can ever be active (is_active = true).

ALTER TABLE public.catalogue_versions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Partial UNIQUE index enforcing database-level single active catalogue constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogue_versions_single_active 
ON public.catalogue_versions (is_active) 
WHERE is_active = true;
