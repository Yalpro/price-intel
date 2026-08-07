/**
 * Database-Backed Global Metadata Smoke Test Runner (Maintenance Test)
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

const dbSmokeProducts = [
  { barcode: '5000112693577', product_name: 'COCA COLA £1.15' },
  { barcode: '5056784913758', product_name: 'MONSTER ENERGY £1.85' },
  { barcode: '90493317', product_name: 'RED BULL £1.75' },
  { barcode: '5010459005025', product_name: 'HIGHLAND SPRING STILL' },
  { barcode: '5060221241847', product_name: 'TANGO ASST ICE POPS' },
  { barcode: '7622202275579', product_name: 'CADBURY STARBAR PM89' },
  { barcode: '5054267016446', product_name: 'LUCOZADE SPORT ORANGE' },
  { barcode: '9999999999999', product_name: 'CONFLICTING ITEM' },
  { barcode: '005000112693577', product_name: 'COCA COLA LEADING ZERO CAN' },
  { barcode: '0000000000000', product_name: 'NON EXISTENT PRODUCT 999' }
];

const csvPath = path.join(__dirname, 'test_db_smoke_10_products.csv');
const csvHeader = 'barcode,product_name\n';
const csvRows = dbSmokeProducts.map(p => `"${p.barcode}","${p.product_name}"`).join('\n');
fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf8');

async function runSupplierDbSmoke(ScraperClass, supplierKey) {
  const scraper = new ScraperClass();
  const stats = await scraper.run(csvPath);
  const runId = scraper.runId;

  const { data: logs } = await supabase
    .from('product_search_logs')
    .select('*')
    .eq('scraper_run_id', runId);

  let suitePassed = true;
  for (let i = 0; i < dbSmokeProducts.length; i++) {
    const src = dbSmokeProducts[i];
    const log = (logs || []).find(l => l.barcode === src.barcode || l.original_product_name === src.product_name) || {};
    const status = log.result_status ? log.result_status.toUpperCase() : 'N/A';
    const isFalsePositive = status === 'SUCCESS' && (src.barcode === '0000000000000' || src.barcode === '9999999999999');
    if (isFalsePositive) suitePassed = false;
  }

  await scraper.close();
  return { supplierKey, suitePassed, stats };
}

async function main() {
  const results = [];
  results.push(await runSupplierDbSmoke(BookerScraper, 'booker'));
  results.push(await runSupplierDbSmoke(ParfettsScraper, 'parfetts'));
  results.push(await runSupplierDbSmoke(BestwayScraper, 'bestway'));
  results.push(await runSupplierDbSmoke(CostcoScraper, 'costco'));

  const allPassed = results.every(r => r.suitePassed);
  console.log(`\nOVERALL DB-BACKED SMOKE TEST RESULT: ${allPassed ? '✅ ALL 4 SUPPLIER DB-BACKED TESTS PASSED' : '❌ SMOKE TEST FAILED'}`);

  if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
}

main().catch(err => {
  console.error('Fatal error in DB-backed smoke tests:', err);
  process.exit(1);
});
