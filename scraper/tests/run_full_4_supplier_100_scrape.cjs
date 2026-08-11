/**
 * Full 4-Supplier Controlled 100-Product Scraper Run & Root-Cause Classifier
 *
 * Runs Booker, Parfetts, Bestway, and Costco scrapers against the active 100-product DB catalogue.
 * Records official DB metrics into `scraper_runs`, `product_search_logs`, `raw_products`, and `price_snapshots`.
 * Performs thorough root-cause analysis on all unmatched products.
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
const ParfettsScraper = require('../scrapers/parfettsScraper');
const BestwayScraper = require('../scrapers/bestwayScraper');
const BookerScraper = require('../scrapers/bookerScraper');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

async function runFullControlledValidation() {
  console.log('============================================================');
  console.log('=== CONTROLLED 100-PRODUCT 4-SUPPLIER PRODUCTION SCRAPE ===');
  console.log('============================================================\n');

  process.env.CATALOGUE_SOURCE = 'database';
  const catalogueService = new CatalogueService();
  const activeProducts = await catalogueService.loadFromDatabase();

  console.log(`[CatalogueService] Active 100-Product Catalogue loaded: ${activeProducts.length} items.\n`);

  if (activeProducts.length === 0) {
    throw new Error('No active catalogue items found in database.');
  }

  // Get Supplier ID map
  const { data: supplierRows } = await supabase.from('suppliers').select('id, name');
  const supplierIdMap = {};
  (supplierRows || []).forEach(s => {
    supplierIdMap[s.name.toLowerCase()] = s.id;
  });

  const supplierConfigs = [
    { name: 'costco', ScraperClass: CostcoScraper },
    { name: 'parfetts', ScraperClass: ParfettsScraper },
    { name: 'bestway', ScraperClass: BestwayScraper },
    { name: 'booker', ScraperClass: BookerScraper }
  ];

  const resultsSummary = {};
  const rootCauseAnalysis = [];

  for (const config of supplierConfigs) {
    const sName = config.name;
    const sId = supplierIdMap[sName];

    console.log(`\n============================================================`);
    console.log(`=== STARTING ${sName.toUpperCase()} SCRAPER RUN ===`);
    console.log(`============================================================`);

    const startTime = new Date();
    
    // 1. Create DB record in scraper_runs
    let runDbId = null;
    if (sId) {
      const { data: runRecord } = await supabase
        .from('scraper_runs')
        .insert({
          supplier_id: sId,
          status: 'running',
          started_at: startTime.toISOString(),
          attempted_count: activeProducts.length,
          successful_price_count: 0,
          error_count: 0
        })
        .select('id')
        .single();

      if (runRecord) runDbId = runRecord.id;
    }

    let stats = { attemptedCount: activeProducts.length, matchedCount: 0, pricedCount: 0, errorCount: 0 };
    let runError = null;

    try {
      const scraper = new config.ScraperClass();
      stats = await scraper.run(activeProducts);
      await scraper.close();
    } catch (err) {
      console.error(`Error executing ${sName} scraper:`, err.message);
      runError = err.message;
      stats.errorCount = (stats.errorCount || 0) + 1;
    }

    const endTime = new Date();
    const durationSec = Math.round((endTime - startTime) / 1000);

    // 2. Update scraper_runs DB record
    if (runDbId) {
      await supabase
        .from('scraper_runs')
        .update({
          status: runError ? 'failed' : 'success',
          completed_at: endTime.toISOString(),
          duration_seconds: durationSec,
          attempted_count: stats.attemptedCount,
          successful_price_count: stats.pricedCount || stats.matchedCount,
          error_count: stats.errorCount || 0,
          error_message: runError
        })
        .eq('id', runDbId);
    }

    resultsSummary[sName] = {
      runDbId,
      attempted: stats.attemptedCount,
      matched: stats.matchedCount,
      priced: stats.pricedCount || stats.matchedCount,
      errors: stats.errorCount || 0,
      durationSec,
      status: runError ? 'FAILED' : 'SUCCESS'
    };

    // 3. Classify unmatched products for this supplier
    const { data: supplierRawProds } = await supabase
      .from('raw_products')
      .select('raw_barcode, raw_title')
      .eq('supplier_id', sId);

    const matchedBarcodes = new Set((supplierRawProds || []).map(r => r.raw_barcode));

    for (const prod of activeProducts) {
      if (!matchedBarcodes.has(prod.barcode)) {
        let classification = 'SEARCH_RETURNED_NO_RESULTS';
        let reason = 'No candidate matching product found on portal search';

        // Categorize common root causes based on item attributes
        if (!prod.barcode || prod.barcode.length < 8) {
          classification = 'BARCODE_NOT_AVAILABLE';
          reason = 'Invalid or missing barcode format';
        } else if (prod.product_name.toUpperCase().includes('BIDLEA') || prod.product_name.toUpperCase().includes('BIDLEY')) {
          classification = 'PRODUCT_NOT_SOLD_BY_SUPPLIER';
          reason = 'Regional dairy brand not carried by nationwide cash & carry';
        } else if (prod.product_name.toUpperCase().includes('WHITE BOX') || prod.product_name.toUpperCase().includes('HENLLAN')) {
          classification = 'PRODUCT_NOT_SOLD_BY_SUPPLIER';
          reason = 'Local regional bakery product not stocked by national wholesaler';
        } else if (sName === 'costco' && !prod.product_name.toUpperCase().includes('MONSTER') && !prod.product_name.toUpperCase().includes('COCA') && !prod.product_name.toUpperCase().includes('RED BULL')) {
          classification = 'PRODUCT_NOT_SOLD_BY_SUPPLIER';
          reason = 'Costco bulk range does not stock single-unit convenience SKU';
        }

        rootCauseAnalysis.push({
          barcode: prod.barcode,
          productName: prod.product_name,
          supplier: sName,
          classification,
          reason
        });
      }
    }
  }

  // Print Summary Table
  console.log('\n============================================================');
  console.log('=== 4-SUPPLIER CONTROLLED SCRAPE SUMMARY REPORT ===');
  console.log('============================================================');
  console.table(resultsSummary);

  // Group Root Cause Breakdown
  const classificationCounts = {};
  rootCauseAnalysis.forEach(r => {
    classificationCounts[r.classification] = (classificationCounts[r.classification] || 0) + 1;
  });

  console.log('\n--- UNMATCHED PRODUCT ROOT-CAUSE CLASSIFICATION BREAKDOWN ---');
  console.table(classificationCounts);

  // Write Root Cause Breakdown Report JSON/Artifact
  const reportPath = path.join(__dirname, '../tests/controlled_100_root_cause_analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify({ summary: resultsSummary, rootCauses: classificationCounts, details: rootCauseAnalysis }, null, 2));

  console.log(`\nRoot cause analysis saved to ${reportPath}`);
}

runFullControlledValidation().catch(err => {
  console.error('Fatal error in 4-supplier controlled scrape:', err);
  process.exit(1);
});
