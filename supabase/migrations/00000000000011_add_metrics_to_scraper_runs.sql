-- Migration: Add detailed observability & metrics columns to scraper_runs
-- Run: Execute manually on Supabase SQL Editor (do not run automatically)
-- Branch: fix/parfetts-data-integrity
-- Date: 2026-08-06
-- Purpose: FIX 5 — Metrics cleanup and reporting accuracy.
--          Separates product matching outcomes, price extraction, stock statuses,
--          and final product failure categories into dedicated counters.
--          Preserves backward compatibility with successful_price_count.

ALTER TABLE scraper_runs
  ADD COLUMN IF NOT EXISTS matched_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priced_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_price_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_stock_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS out_of_stock_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unknown_stock_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ambiguous_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_found_count INTEGER DEFAULT 0;

-- Comment on columns for schema documentation
COMMENT ON COLUMN scraper_runs.matched_count IS 'Total products successfully matched (result_status = success)';
COMMENT ON COLUMN scraper_runs.priced_count IS 'Total matched products with a valid non-null price';
COMMENT ON COLUMN scraper_runs.missing_price_count IS 'Total matched products where price was null/missing';
COMMENT ON COLUMN scraper_runs.in_stock_count IS 'Total matched products confirmed in stock (in_stock = true)';
COMMENT ON COLUMN scraper_runs.out_of_stock_count IS 'Total matched products confirmed out of stock (in_stock = false)';
COMMENT ON COLUMN scraper_runs.unknown_stock_count IS 'Total matched products with unknown stock status (in_stock = null)';
COMMENT ON COLUMN scraper_runs.ambiguous_count IS 'Total products whose final outcome was ambiguous';
COMMENT ON COLUMN scraper_runs.rejected_count IS 'Total products whose final outcome was rejected';
COMMENT ON COLUMN scraper_runs.not_found_count IS 'Total products not found after all search strategies';
