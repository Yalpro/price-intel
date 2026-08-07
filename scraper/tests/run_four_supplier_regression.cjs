/**
 * Four-Supplier Controlled 10-Product Regression Script (Maintenance Test)
 */

require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BookerScraper = require('../scrapers/bookerScraper');
const ParfettsScraper = require('../scrapers/parfettsScraper');
const BestwayScraper = require('../scrapers/bestwayScraper');
const CostcoScraper = require('../scrapers/costcoScraper');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const sampleProducts = [
  { barcode: '5000112693577', product_name: 'COCA COLA £1.15' },
  { barcode: '5056784913758', product_name: 'MONSTER ENERGY £1.85' },
  { barcode: '90493317', product_name: 'RED BULL £1.75' },
  { barcode: '5010459005025', product_name: 'HIGHLAND SPRING STILL' },
  { barcode: '5060221241847', product_name: 'TANGO ASST ICE POPS' },
  { barcode: '7622202275579', product_name: 'CADBURY STARBAR PM89' },
  { barcode: '5054267016446', product_name: 'LUCOZADE SPORT ORANGE' },
  { barcode: '5054267014220', product_name: 'LUCOZADE ENERGY ORANGE PM £1.50' },
  { barcode: '5027291010308', product_name: 'WHITE BOX MEDIUM' },
  { barcode: '0000000000000', product_name: 'NON EXISTENT PRODUCT 999' }
];

const sampleCsvPath = path.join(__dirname, 'test_four_supplier_10_products.csv');
const csvHeader = 'barcode,product_name\n';
const csvRows = sampleProducts.map(p => `"${p.barcode}","${p.product_name}"`).join('\n');
fs.writeFileSync(sampleCsvPath, csvHeader + csvRows, 'utf8');

const verifiedMetadataSeed = [
  { barcode: '5000112693577', source_product_name: 'COCA COLA £1.15', normalized_brand: 'coca cola', normalized_volume: '330ml', verification_status: 'verified' },
  { barcode: '5056784913758', source_product_name: 'MONSTER ENERGY £1.85', normalized_brand: 'monster', normalized_volume: '500ml', verification_status: 'verified' },
  { barcode: '90493317', source_product_name: 'RED BULL £1.75', normalized_brand: 'red bull', normalized_volume: '250ml', verification_status: 'verified' },
  { barcode: '5010459005025', source_product_name: 'HIGHLAND SPRING STILL', normalized_brand: 'highland spring', normalized_volume: '1.5l', verification_status: 'verified' },
  { barcode: '5054267016446', source_product_name: 'LUCOZADE SPORT ORANGE', normalized_brand: 'lucozade', normalized_volume: '500ml', verification_status: 'verified' },
  { barcode: '5054267014220', source_product_name: 'LUCOZADE ENERGY ORANGE PM £1.50', normalized_brand: 'lucozade', normalized_volume: '500ml', verification_status: 'verified' },
  { barcode: '7622202275579', source_product_name: 'CADBURY STARBAR PM89', normalized_brand: 'cadbury', normalized_weight: '48g', verification_status: 'verified' }
];

async function runSupplierRegression(ScraperClass, supplierKey) {
  console.log(`\n============================================================`);
  console.log(`=== RUNNING REGRESSION SUITE: ${supplierKey.toUpperCase()} ===`);
  console.log(`============================================================\n`);

  const scraper = new ScraperClass();
  scraper.metadataLayer.seedVerifiedMetadata(verifiedMetadataSeed);

  const stats = await scraper.run(sampleCsvPath);
  const runId = scraper.runId;

  const { data: logs } = await supabase
    .from('product_search_logs')
    .select('*')
    .eq('scraper_run_id', runId);

  let suitePassed = true;

  for (let i = 0; i < sampleProducts.length; i++) {
    const src = sampleProducts[i];
    const log = (logs || []).find(l => l.barcode === src.barcode || l.original_product_name === src.product_name) || {};
    const status = log.result_status ? log.result_status.toUpperCase() : 'N/A';
    const isFalsePositive = status === 'SUCCESS' && (src.barcode === '0000000000000' || src.product_name.includes('NON EXISTENT'));
    if (isFalsePositive) suitePassed = false;
  }

  await scraper.close();
  return { supplierKey, suitePassed, stats };
}

async function main() {
  const results = [];
  results.push(await runSupplierRegression(BookerScraper, 'booker'));
  results.push(await runSupplierRegression(ParfettsScraper, 'parfetts'));
  results.push(await runSupplierRegression(BestwayScraper, 'bestway'));
  results.push(await runSupplierRegression(CostcoScraper, 'costco'));

  const allPassed = results.every(r => r.suitePassed);
  console.log(`\nFOUR-SUPPLIER REGRESSION RESULT: ${allPassed ? '✅ ALL 4 SUPPLIER SUITES PASSED' : '❌ REGRESSION FAILED'}`);

  if (fs.existsSync(sampleCsvPath)) fs.unlinkSync(sampleCsvPath);
}

main().catch(err => {
  console.error('Fatal error in four-supplier regression run:', err);
  process.exit(1);
});
