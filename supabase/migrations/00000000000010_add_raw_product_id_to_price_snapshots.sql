-- Migration: Add raw_product_id FK column to price_snapshots
-- Run: Execute on Supabase SQL Editor (do not run automatically)
-- Branch: fix/parfetts-data-integrity
-- Date: 2026-08-05
-- Purpose: FIX 1 (Bug #3 & #5) — Link every price snapshot to its source raw_product
--          record vQia a foreign key. Previously this column was missing from the INSERT
--          payload in BaseScraper.js, causing all snapshots to have raw_product_id = NULL
--          and forcing unreliable time-proximity joins for price traceability.

-- Step 1: Add the column (nullable initially to preserve existing rows)
ALTER TABLE price_snapshots
  ADD COLUMN IF NOT EXISTS raw_product_id BIGINT REFERENCES raw_products(id) ON DELETE SET NULL;

-- Step 2: Create an index for efficient JOIN queries
CREATE INDEX IF NOT EXISTS idx_price_snapshots_raw_product_id
  ON price_snapshots (raw_product_id);

-- Step 3: (Optional, run AFTER verifying new runs populate the column correctly)
-- Verify that new inserts are no longer null:
-- SELECT id, raw_product_id, supplier_id, case_price, snapshot_at
-- FROM price_snapshots
-- ORDER BY snapshot_at DESC
-- LIMIT 20;
