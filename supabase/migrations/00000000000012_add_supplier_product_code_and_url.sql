-- Migration: Add supplier product code and full raw URL to raw_products and product_search_logs
-- Created for FIX 1: Persisting authentic wholesaler product codes and PDP URLs

ALTER TABLE raw_products
  ADD COLUMN IF NOT EXISTS raw_product_code text,
  ADD COLUMN IF NOT EXISTS raw_url text;

ALTER TABLE product_search_logs
  ADD COLUMN IF NOT EXISTS selected_candidate_code text,
  ADD COLUMN IF NOT EXISTS selected_candidate_url text;
