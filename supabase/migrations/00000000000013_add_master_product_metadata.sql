-- Migration 13: Create Master Product Metadata Table
-- Stores canonical global product metadata keyed by normalized barcode string.

CREATE TABLE IF NOT EXISTS public.master_product_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL UNIQUE,
  source_product_name TEXT,
  normalized_brand TEXT,
  normalized_variant TEXT,
  normalized_volume TEXT,
  normalized_weight TEXT,
  normalized_pack TEXT,
  normalized_category TEXT,
  metadata_source TEXT NOT NULL DEFAULT 'source_title',
  confidence_score INTEGER NOT NULL DEFAULT 50,
  verification_status TEXT NOT NULL DEFAULT 'auto_verified' CHECK (verification_status IN ('verified', 'auto_verified', 'needs_review', 'incomplete')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on barcode for fast O(1) metadata enrichment lookups
CREATE INDEX IF NOT EXISTS idx_master_product_metadata_barcode ON public.master_product_metadata (barcode);
CREATE INDEX IF NOT EXISTS idx_master_product_metadata_status ON public.master_product_metadata (verification_status);

-- RLS Policies
ALTER TABLE public.master_product_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to master_product_metadata"
  ON public.master_product_metadata FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to master_product_metadata"
  ON public.master_product_metadata FOR ALL
  USING (true);
