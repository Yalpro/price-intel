-- Migration: 00000000000008_add_costco_supplier.sql
-- Purpose: Add Costco as a supplier in the suppliers table.
-- The original seeder in migration 00000000000001 did not include Costco.
-- Note: suppliers.name has no unique constraint, so we use WHERE NOT EXISTS.

INSERT INTO public.suppliers (name, type, active)
SELECT 'costco', 'wholesaler', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.suppliers WHERE name = 'costco'
);
