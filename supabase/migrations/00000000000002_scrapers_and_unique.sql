-- 1. Add unique constraint to raw_products to enable upserting safely
ALTER TABLE raw_products
ADD CONSTRAINT raw_products_supplier_barcode_key UNIQUE (supplier_id, raw_barcode);

-- 2. Create scraper_runs table to track execution history
CREATE TABLE scraper_runs (
  id bigint generated always as identity primary key,
  supplier_id bigint references suppliers(id),
  status text check (status in ('running', 'success', 'failed')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  duration_seconds integer,
  attempted_count integer default 0,
  successful_price_count integer default 0,
  missing_pack_count integer default 0,
  error_count integer default 0,
  log text
);

-- Enable RLS on scraper_runs
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins to view scraper runs
CREATE POLICY "Allow authenticated admins to select scraper_runs" ON scraper_runs FOR SELECT TO authenticated USING (true);
