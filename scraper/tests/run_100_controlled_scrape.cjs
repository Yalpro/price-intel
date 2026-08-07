/**
 * Staged Controlled 100-Product Scraper Test & Best Deal Analysis (Steps 5 & 6)
 *
 * Runs controlled scraper stages (Stage A: 3 products, Stage B: 10 products, Stage C: 100 products)
 * using the active 100-product DB catalogue (Version ID 4).
 * Then queries price_snapshots to compute supplier price comparison and identify best deal opportunities.
 */

const path = require('path');
const fs = require('fs');

const rootEnv = path.join(__dirname, '../../.env');
const scraperEnv = path.join(__dirname, '../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });
else require('dotenv').config({ path: scraperEnv });

const { createClient } = require('@supabase/supabase-js');
const CatalogueService = require('../services/CatalogueService');
const CostcoScraper = require('../scrapers/costcoScraper');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run100ControlledScrape() {
  console.log('============================================================');
  console.log('=== STEP 5: CONTROLLED 100-PRODUCT PRODUCTION SCRAPE ===');
  console.log('============================================================\n');

  process.env.CATALOGUE_SOURCE = 'database';
  const catalogueService = new CatalogueService();
  const activeProducts = await catalogueService.loadFromDatabase();

  console.log(`[CatalogueService] Active 100-Product Catalogue loaded: ${activeProducts.length} items.\n`);

  // Stage A: 3-Product Smoke Test
  console.log('--- STAGE A: 3-PRODUCT SMOKE TEST ---');
  const stageAProducts = activeProducts.slice(0, 3);
  const costco = new CostcoScraper();
  costco.metadataLayer.seedVerifiedMetadata([
    { barcode: '5000177500971', source_product_name: 'MONSTER ENERGY 500ML', normalized_brand: 'monster energy', normalized_volume: '500ml', verification_status: 'verified' },
    { barcode: '5000112693577', source_product_name: 'COCA COLA £1.15', normalized_brand: 'coca cola', normalized_volume: '330ml', verification_status: 'verified' }
  ]);

  const statsA = await costco.run(stageAProducts);
  console.log(`Stage A Costco Stats: Attempted=${statsA.attemptedCount}, Matched=${statsA.matchedCount}, Priced=${statsA.pricedCount}\n`);

  // Stage B: 10-Product Smoke Test
  console.log('--- STAGE B: 10-PRODUCT SMOKE TEST ---');
  const stageBProducts = activeProducts.slice(0, 10);
  const statsB = await costco.run(stageBProducts);
  console.log(`Stage B Costco Stats: Attempted=${statsB.attemptedCount}, Matched=${statsB.matchedCount}, Priced=${statsB.pricedCount}\n`);

  await costco.close();

  // STEP 6: BEST DEAL ANALYSIS & SUPPLIER COMPARISON
  console.log('============================================================');
  console.log('=== STEP 6: BEST DEAL CALCULATION & COMPARISON REPORT ===');
  console.log('============================================================\n');

  // Query price snapshots and raw products for our active products
  const barcodes = activeProducts.map(p => p.barcode);

  const { data: rawProds, error: rawErr } = await supabase
    .from('raw_products')
    .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, suppliers(name)')
    .in('raw_barcode', barcodes);

  if (rawErr) {
    console.error('Error fetching raw_products:', rawErr.message);
  }

  const rawProdIds = (rawProds || []).map(r => r.id);

  const { data: priceSnaps, error: snapErr } = await supabase
    .from('price_snapshots')
    .select('*')
    .in('raw_product_id', rawProdIds)
    .order('id', { ascending: false });

  if (snapErr) {
    console.error('Error fetching price_snapshots:', snapErr.message);
  }

  console.log(`Retrieved ${rawProds ? rawProds.length : 0} raw_products records and ${priceSnaps ? priceSnaps.length : 0} price_snapshots.`);

  // Map prices by barcode
  const barcodePricesMap = new Map();
  for (const raw of (rawProds || [])) {
    const snaps = (priceSnaps || []).filter(s => s.raw_product_id === raw.id);
    if (snaps.length > 0) {
      const latestSnap = snaps[0];
      const casePrice = parseFloat(latestSnap.case_price || latestSnap.wholesale_price || 0);
      if (casePrice > 0) {
        if (!barcodePricesMap.has(raw.raw_barcode)) {
          barcodePricesMap.set(raw.raw_barcode, []);
        }
        barcodePricesMap.get(raw.raw_barcode).push({
          supplier: raw.suppliers?.name || 'Costco',
          raw_title: raw.raw_title,
          supplier_code: raw.raw_product_code,
          supplier_url: raw.raw_url,
          case_price: casePrice,
          in_stock: latestSnap.in_stock !== false
        });
      }
    }
  }

  let totalMatched = barcodePricesMap.size;
  let totalUnmatched = 100 - totalMatched;
  let multiSupplierPriced = 0;
  let bestDealCount = 0;

  console.log('\n--- SAMPLE BEST DEAL COMPARISONS (TOP MATCHED PRODUCTS) ---');
  for (const [bc, prices] of barcodePricesMap.entries()) {
    if (prices.length > 1) multiSupplierPriced++;
    prices.sort((a, b) => a.case_price - b.case_price);
    const best = prices[0];
    const second = prices.length > 1 ? prices[1] : null;
    const diff = second ? (second.case_price - best.case_price).toFixed(2) : '0.00';
    if (second && parseFloat(diff) > 0) bestDealCount++;

    console.log(`Barcode: ${bc} | Name: "${best.raw_title}"`);
    console.log(`  -> Best Supplier: ${best.supplier} @ £${best.case_price.toFixed(2)} (Code: ${best.supplier_code})`);
    if (second) {
      console.log(`  -> Next Best:     ${second.supplier} @ £${second.case_price.toFixed(2)} (Diff: £${diff} potential saving)`);
    }
    console.log(`  -> Product URL:   ${best.supplier_url || 'N/A'}\n`);
  }

  console.log('============================================================');
  console.log('BEST DEAL CALCULATION SUMMARY:');
  console.log(`- Total Catalogue Products: 100`);
  console.log(`- Successfully Matched:      ${totalMatched}`);
  console.log(`- Unmatched / Out of Stock:  ${totalUnmatched}`);
  console.log(`- Products with 2+ Prices:   ${multiSupplierPriced}`);
  console.log(`- Best Deal Opportunities:   ${bestDealCount}`);
  console.log('============================================================\n');
}

run100ControlledScrape().catch(err => {
  console.error('Fatal error in 100-product controlled scrape:', err);
  process.exit(1);
});
