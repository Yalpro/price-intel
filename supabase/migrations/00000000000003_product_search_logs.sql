-- 1. Create product_search_logs table
CREATE TABLE product_search_logs (
  id bigint generated always as identity primary key,
  scraper_run_id bigint not null references scraper_runs(id) on delete cascade,
  supplier_id bigint not null references suppliers(id),
  source_catalogue_key text,
  raw_product_id bigint references raw_products(id) on delete set null,
  barcode text,
  original_product_name text not null,
  attempt_number integer not null check (attempt_number > 0),
  search_strategy text not null check (
    search_strategy in ('barcode', 'normalized_barcode', 'exact_name', 'cleaned_name', 'brand_core')
  ),
  searched_term text not null,
  result_status text not null check (
    result_status in ('success', 'not_found', 'ambiguous', 'rejected', 'error')
  ),
  validation_score numeric check (validation_score >= 0 and validation_score <= 100),
  validation_reason text,
  conflicting_fields text,
  matched_fields text,
  matched_supplier_product_title text,
  matched_supplier_barcode text,
  candidate_count integer default 0 check (candidate_count >= 0),
  search_duration_ms integer check (search_duration_ms >= 0),
  error_message text,
  created_at timestamptz not null default now()
);

-- Performance Indexes
CREATE INDEX idx_search_logs_run_attempt ON product_search_logs(scraper_run_id, attempt_number);
CREATE INDEX idx_search_logs_supplier_created ON product_search_logs(supplier_id, created_at);
CREATE INDEX idx_search_logs_raw_product_id ON product_search_logs(raw_product_id);
CREATE INDEX idx_search_logs_result_status ON product_search_logs(result_status);

-- RLS Policies
ALTER TABLE product_search_logs ENABLE ROW LEVEL SECURITY;

-- Note: Only explicit admins should have access. As an admin roles table doesn't exist yet, 
-- we keep the table inaccessible to normal authenticated users (no policy defined).
