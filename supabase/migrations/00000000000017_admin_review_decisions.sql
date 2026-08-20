-- Migration 17: Admin Review Decisions & Persistent Rejection Audit
-- Stores immutable human admin review decisions (ACCEPTED / REJECTED)
-- to prevent previously rejected candidates from being re-published by future scraper runs.

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.admin_review_decisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  catalogue_item_id BIGINT REFERENCES public.catalogue_items(id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  raw_product_id BIGINT REFERENCES public.raw_products(id) ON DELETE SET NULL,
  search_log_id BIGINT REFERENCES public.product_search_logs(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('ADMIN_ACCEPTED', 'ADMIN_REJECTED')),
  source TEXT NOT NULL DEFAULT 'ADMIN' CHECK (source IN ('ADMIN', 'DETERMINISTIC', 'AI_ASSISTED')),
  reason_code TEXT, -- e.g. 'EAN_MISMATCH', 'BRAND_MISMATCH', 'MULTIPACK_MISMATCH', 'VOLUME_MISMATCH', 'ADMIN_REJECTED'
  comment TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create performance indexes for queue filtering and daily scraper rejection checks
CREATE INDEX IF NOT EXISTS idx_admin_review_decisions_item_supplier ON public.admin_review_decisions (catalogue_item_id, supplier_id, is_current);
CREATE INDEX IF NOT EXISTS idx_admin_review_decisions_raw_product ON public.admin_review_decisions (raw_product_id);
CREATE INDEX IF NOT EXISTS idx_admin_review_decisions_decision ON public.admin_review_decisions (decision);

-- 3. Enable RLS
ALTER TABLE public.admin_review_decisions ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if they exist (Idempotency)
DROP POLICY IF EXISTS "Allow admins select on admin_review_decisions" ON public.admin_review_decisions;
DROP POLICY IF EXISTS "Allow admins insert on admin_review_decisions" ON public.admin_review_decisions;
DROP POLICY IF EXISTS "Allow admins update on admin_review_decisions" ON public.admin_review_decisions;
DROP POLICY IF EXISTS "Allow service role full access to admin_review_decisions" ON public.admin_review_decisions;

-- 5. Create RLS policies using public.is_admin() and service_role
CREATE POLICY "Allow admins select on admin_review_decisions"
  ON public.admin_review_decisions FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow admins insert on admin_review_decisions"
  ON public.admin_review_decisions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Allow admins update on admin_review_decisions"
  ON public.admin_review_decisions FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Allow service role full access to admin_review_decisions"
  ON public.admin_review_decisions FOR ALL TO service_role
  USING (true);
