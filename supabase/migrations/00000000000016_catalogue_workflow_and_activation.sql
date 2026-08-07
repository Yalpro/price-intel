-- Migration 16: Idempotent Patch for Production Catalogue Workflow & Atomic Activation
-- Preserves existing live table schemas (bigint IDs, version_id FK column)
-- Adds fields for month, checksum, status workflow, row counts, and atomic activation function.

-- 1. Enhance catalogue_versions table
ALTER TABLE public.catalogue_versions
  ADD COLUMN IF NOT EXISTS catalogue_month DATE,
  ADD COLUMN IF NOT EXISTS original_file_name TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'catalogue-imports',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_checksum TEXT,
  ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warning_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalid_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_product_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS removed_product_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS changed_name_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_by UUID,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure CHECK constraint on status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalogue_versions_status_check'
  ) THEN
    ALTER TABLE public.catalogue_versions 
    ADD CONSTRAINT catalogue_versions_status_check 
    CHECK (status IN ('uploaded', 'validating', 'validation_failed', 'ready_for_review', 'active', 'archived', 'rejected'));
  END IF;
END $$;

-- 2. Enhance catalogue_items table
ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS row_number INTEGER,
  ADD COLUMN IF NOT EXISTS source_product_name TEXT,
  ADD COLUMN IF NOT EXISTS source_price_mark TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_row JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure source_product_name is populated from name if empty
UPDATE public.catalogue_items SET source_product_name = name WHERE source_product_name IS NULL;

-- 3. Create catalogue_import_errors table if not exists
CREATE TABLE IF NOT EXISTS public.catalogue_import_errors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version_id BIGINT NOT NULL REFERENCES public.catalogue_versions(id) ON DELETE CASCADE,
  row_number INTEGER,
  barcode TEXT,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  raw_row JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast error retrieval
CREATE INDEX IF NOT EXISTS idx_catalogue_import_errors_version ON public.catalogue_import_errors (version_id);

-- 4. Partial UNIQUE Index ensuring AT MOST ONE active catalogue version
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogue_versions_single_active 
ON public.catalogue_versions (is_active) 
WHERE is_active = true;

-- 5. Atomic Activation and Rollback Database Function
CREATE OR REPLACE FUNCTION public.activate_catalogue_version(
  p_version_id BIGINT,
  p_activated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_record RECORD;
  v_active_count INTEGER;
BEGIN
  -- Obtain advisory lock to serialize concurrent activation requests
  PERFORM pg_advisory_xact_lock(7429103);

  -- Fetch target record
  SELECT * INTO v_target_record
  FROM public.catalogue_versions
  WHERE id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target catalogue version ID % does not exist.', p_version_id;
  END IF;

  IF v_target_record.status NOT IN ('ready_for_review', 'archived', 'active') THEN
    RAISE EXCEPTION 'Catalogue version ID % has status "%", which cannot be activated. Must be ready_for_review or archived.', p_version_id, v_target_record.status;
  END IF;

  -- Step 1: Archive all currently active versions
  UPDATE public.catalogue_versions
  SET is_active = false,
      status = 'archived',
      archived_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE is_active = true AND id <> p_version_id;

  -- Step 2: Activate target version
  UPDATE public.catalogue_versions
  SET is_active = true,
      status = 'active',
      activated_at = timezone('utc'::text, now()),
      activated_by = COALESCE(p_activated_by, p_activated_by),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_version_id;

  -- Step 3: Verify single active version invariant
  SELECT COUNT(*) INTO v_active_count
  FROM public.catalogue_versions
  WHERE is_active = true;

  IF v_active_count <> 1 THEN
    RAISE EXCEPTION 'Activation failed invariant test: Expected exactly 1 active catalogue, found %.', v_active_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'status', 'active',
    'activated_at', timezone('utc'::text, now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_catalogue_version(BIGINT, UUID) TO authenticated;

-- 6. RLS Policies for catalogue_import_errors
ALTER TABLE public.catalogue_import_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins to select catalogue_import_errors" ON public.catalogue_import_errors;
DROP POLICY IF EXISTS "Allow admins to insert catalogue_import_errors" ON public.catalogue_import_errors;

CREATE POLICY "Allow admins to select catalogue_import_errors"
  ON public.catalogue_import_errors FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow admins to insert catalogue_import_errors"
  ON public.catalogue_import_errors FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
