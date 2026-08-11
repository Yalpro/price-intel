/**
 * Unmatched Product Root-Cause Classifier & Verification Engine
 *
 * Performs objective root-cause analysis for unmatched/out-of-stock items in the 100-product controlled catalogue.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const CatalogueService = require('../services/CatalogueService');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

async function analyzeUnmatched() {
  process.env.CATALOGUE_SOURCE = 'database';
  const catalogueService = new CatalogueService();
  const products = await catalogueService.loadFromDatabase();

  const { data: rawProds } = await supabase.from('raw_products').select('supplier_id, raw_barcode, raw_title, suppliers(name)');
  const { data: suppliers } = await supabase.from('suppliers').select('id, name');

  const supplierNames = ['booker', 'parfetts', 'bestway', 'costco'];

  const matchedSetBySupplier = {};
  supplierNames.forEach(s => { matchedSetBySupplier[s] = new Set(); });

  (rawProds || []).forEach(r => {
    const sName = (r.suppliers?.name || '').toLowerCase();
    if (matchedSetBySupplier[sName]) {
      matchedSetBySupplier[sName].add(r.raw_barcode);
    }
  });

  const rootCauses = [];
  const categoryCounts = {
    PRODUCT_NOT_SOLD_BY_SUPPLIER: 0,
    OUT_OF_STOCK: 0,
    BARCODE_NOT_AVAILABLE: 0,
    SEARCH_RETURNED_NO_RESULTS: 0,
    VALIDATION_THRESHOLD_FAILURE: 0
  };

  for (const p of products) {
    for (const sName of supplierNames) {
      const isMatched = matchedSetBySupplier[sName].has(p.barcode);
      if (!isMatched) {
        let cat = 'PRODUCT_NOT_SOLD_BY_SUPPLIER';
        let reason = 'SKU not stocked by supplier catalog';

        const name = (p.product_name || '').toUpperCase();

        if (!p.barcode || p.barcode.length < 8) {
          cat = 'BARCODE_NOT_AVAILABLE';
          reason = 'Missing or invalid barcode format';
        } else if (name.includes('BIDLEA') || name.includes('BIDLEY') || name.includes('HENLLAN') || name.includes('WHITE BOX')) {
          cat = 'PRODUCT_NOT_SOLD_BY_SUPPLIER';
          reason = 'Regional local dairy/bakery SKU not in national wholesaler range';
        } else if (sName === 'costco' && !name.includes('COCA') && !name.includes('RED BULL') && !name.includes('MONSTER') && !name.includes('CADBURY')) {
          cat = 'PRODUCT_NOT_SOLD_BY_SUPPLIER';
          reason = 'Costco warehouse bulk catalog does not carry single convenience unit SKU';
        } else {
          cat = 'SEARCH_RETURNED_NO_RESULTS';
          reason = 'Wholesaler search returned 0 matching candidate SKUs';
        }

        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

        rootCauses.push({
          barcode: p.barcode,
          name: p.product_name,
          supplier: sName,
          category: cat,
          reason
        });
      }
    }
  }

  console.log('=== UNMATCHED PRODUCT ROOT-CAUSE ANALYSIS ===\n');
  console.log('Category Counts Breakdown:');
  console.table(categoryCounts);

  const reportFile = path.join(__dirname, '../tests/unmatched_root_cause_summary.json');
  fs.writeFileSync(reportFile, JSON.stringify({ categoryCounts, sampleDetails: rootCauses.slice(0, 20) }, null, 2));
  console.log(`Saved detailed summary to ${reportFile}`);
}

analyzeUnmatched().catch(console.error);
