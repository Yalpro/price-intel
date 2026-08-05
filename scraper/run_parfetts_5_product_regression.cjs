/**
 * Controlled 5-Product Parfetts Regression Test
 * Validates FIX 1 (supplier URL & code persistence) & FIX 2 (wholesale ex-VAT price extraction)
 */

require('dotenv').config({ path: '../.env' });
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const ParfettsScraper = require('./scrapers/parfettsScraper');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== PARFETTS 5-PRODUCT CONTROLLED REGRESSION VALIDATION ===\n');

  // Create temporary CSV containing ONLY the 5 target products
  const fs = require('fs');
  const tempCsvPath = path.join(__dirname, 'temp_parfetts_5_products.csv');
  const csvContent = `product_name,barcode
COCA COLA ORIGINAL TASTE 330ML,5000112693577
MONSTER ENERGY ORIGINAL 500ML,5000177500971
GO LOCAL SENSITIVE BABY WIPES PM 89P,5000112693999
COCA COLA LIME PM £1.85 500ML,5000112527353
HIGHLAND SPRING STILL WATER 1.5L,5010459015178`;

  fs.writeFileSync(tempCsvPath, csvContent, 'utf8');

  const scraper = new ParfettsScraper();
  
  console.log('Launching Parfetts 5-product regression run...');
  const stats = await scraper.run(tempCsvPath);

  // Clean up temporary CSV file
  try { fs.unlinkSync(tempCsvPath); } catch (e) {}

  const runId = scraper.runId;
  console.log(`\n=== Run ID: ${runId} Finished ===`);
  console.log('Stats:', stats);

  // Fetch scraper_runs row
  const { data: runRow } = await supabase
    .from('scraper_runs')
    .select('*')
    .eq('id', runId)
    .single();

  console.log('\n=== DB scraper_runs Row Metrics ===');
  console.log(JSON.stringify(runRow, null, 2));

  // Now perform individual product verification and live PDP check for each of the 5 products
  const products = [
    { name: 'COCA COLA ORIGINAL TASTE 330ML', barcode: '5000112693577', expectedCode: '128664' },
    { name: 'MONSTER ENERGY ORIGINAL 500ML', barcode: '5000177500971', expectedCode: '125505' },
    { name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P', barcode: '5000112693999', expectedCode: '123190' },
    { name: 'COCA COLA LIME PM £1.85 500ML', barcode: '5000112527353', expectedCode: '273533' },
    { name: 'HIGHLAND SPRING STILL WATER 1.5L', barcode: '5010459015178', expectedCode: '992155' },
  ];

  const page = await scraper.login();

  let passCount = 0;
  console.log('\n=== INDIVIDUAL 5-PRODUCT EVIDENCE REPORT ===\n');

  for (const p of products) {
    console.log(`------------------------------------------------------------`);
    console.log(`SOURCE TITLE: "${p.name}" (Barcode: ${p.barcode})`);

    // Fetch raw_products row
    const { data: rawProduct } = await supabase
      .from('raw_products')
      .select('*')
      .eq('supplier_id', scraper.supplierRow.id)
      .eq('raw_barcode', p.barcode)
      .single();

    // Fetch price_snapshots row
    let snapshot = null;
    if (rawProduct) {
      const { data: snapRows } = await supabase
        .from('price_snapshots')
        .select('*')
        .eq('raw_product_id', rawProduct.id)
        .order('snapshot_at', { ascending: false })
        .limit(1);
      snapshot = snapRows && snapRows.length > 0 ? snapRows[0] : null;
    }

    const storedSupplierCode = rawProduct?.raw_product_code || 'N/A';
    const storedSupplierUrl = rawProduct?.raw_url || 'N/A';
    const rawProductId = rawProduct?.id || 'N/A';
    const snapshotId = snapshot?.id || 'N/A';
    const fkLinked = snapshot && rawProduct ? (snapshot.raw_product_id === rawProduct.id) : false;
    const storedCasePrice = snapshot ? snapshot.case_price : null;

    // Navigate live to storedSupplierUrl
    let livePageUrl = 'N/A';
    let liveH1 = 'N/A';
    let liveBodySnippet = '';
    
    if (storedSupplierUrl && storedSupplierUrl.startsWith('http')) {
      await page.goto(storedSupplierUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      livePageUrl = page.url();
      liveH1 = (await page.innerText('h1, h2').catch(() => '')).trim();
      liveBodySnippet = await page.innerText('body').catch(() => '');
    }

    const codeCorrect = storedSupplierCode === p.expectedCode;
    const urlCorrect = storedSupplierUrl.includes(`/product/${p.expectedCode}`);
    const noRawIdInUrl = !storedSupplierUrl.includes(`/product/${rawProductId}`);
    const priceIsNotPmp = storedCasePrice && storedCasePrice > 2.00; // Case price for these is > £5.00
    const pass = codeCorrect && urlCorrect && noRawIdInUrl && fkLinked && priceIsNotPmp;

    if (pass) passCount++;

    console.log(`  Expected Code:        ${p.expectedCode}`);
    console.log(`  Stored Supplier Code: ${storedSupplierCode}`);
    console.log(`  Raw href / Stored URL:${storedSupplierUrl}`);
    console.log(`  page.url() Live PDP:  ${livePageUrl}`);
    console.log(`  Live H1 Title:        "${liveH1}"`);
    console.log(`  Wholesale Price Selector: "div.font-bold, cardTextForPrice.match(/£(\\d+\\.\\d{2})/)"`);
    console.log(`  Extracted Case Price: £${storedCasePrice}`);
    console.log(`  Pack Size:            "${rawProduct?.raw_pack_info || 'N/A'}"`);
    console.log(`  Stock Status:         ${snapshot?.in_stock}`);
    console.log(`  raw_products.id:      ${rawProductId}`);
    console.log(`  price_snapshots.id:   ${snapshotId}`);
    console.log(`  FK Linkage:           raw_products.id=${rawProductId} === price_snapshots.raw_product_id=${snapshot?.raw_product_id} (${fkLinked ? 'MATCH' : 'MISMATCH'})`);
    console.log(`  RESULT:               ${pass ? '✅ PASS' : '❌ FAIL'}`);
  }

  await scraper.close();

  console.log('\n============================================================');
  console.log(`5-PRODUCT REGRESSION RESULT: ${passCount === 5 ? '✅ ALL 5 PRODUCTS PASSED' : '❌ REGRESSION FAILED'}`);
  console.log('============================================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
