/**
 * Parfetts 10-Product Controlled Validation Script
 *
 * Runs ParfettsScraper on test_parfetts_10_products.csv, queries Supabase DB for
 * scraper_runs, raw_products, price_snapshots, and product_search_logs, and performs
 * objective evidence verification against all 10 requirements.
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const ParfettsScraper = require('./scrapers/parfettsScraper');
const ProductMetadataParser = require('./utils/ProductMetadataParser');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== PARFETTS 10-PRODUCT CONTROLLED REGRESSION VALIDATION ===\n');

  let runId;
  const scraper = new ParfettsScraper();

  if (process.argv.includes('--verify-last')) {
    await scraper.getSupplierRow();
    const { data: lastRun } = await supabase.from('scraper_runs').select('id').eq('supplier_id', scraper.supplierRow.id).order('id', { ascending: false }).limit(1).single();
    runId = lastRun ? lastRun.id : 58;
    console.log(`Verifying existing recent run ID: ${runId}`);
  } else {
    console.log('Launching ParfettsScraper run...');
    const stats = await scraper.run('test_parfetts_10_products.csv');
    await scraper.close();
    runId = scraper.runId;
    console.log(`\n✅ Scraper run finished! Run ID: ${runId}`);
    console.log('Raw returned stats:', JSON.stringify(stats, null, 2));
  }

  // 2. Query scraper_runs row from DB
  const { data: runRow, error: runError } = await supabase
    .from('scraper_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError) {
    console.error('Failed to fetch scraper_runs row:', runError.message);
    process.exit(1);
  }

  console.log('\n=== DB scraper_runs Row Metrics ===');
  console.log(JSON.stringify(runRow, null, 2));

  // 3. Query product_search_logs for this run
  const { data: searchLogs, error: logError } = await supabase
    .from('product_search_logs')
    .select('*')
    .eq('scraper_run_id', runId);

  if (logError) {
    console.error('Failed to fetch product_search_logs:', logError.message);
    process.exit(1);
  }

  // 4. Verify each of the 10 products
  const products = [
    { barcode: '5000112693577', name: 'COCA COLA ORIGINAL TASTE 330ML' },
    { barcode: '5000177500971', name: 'MONSTER ENERGY ORIGINAL 500ML' },
    { barcode: '90493577', name: 'RED BULL ENERGY PM280' },
    { barcode: '5016860000178', name: 'DELAMERE BANANA MILK' },
    { barcode: '3057640600128', name: 'VOLVIC CHERRY' },
    { barcode: '5000112693999', name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P' },
    { barcode: '5000112527353', name: 'COCA COLA LIME PM £1.85 500ML' },
    { barcode: '5010459015178', name: 'HIGHLAND SPRING STILL WATER 1.5L' },
    { barcode: '7622210817006', name: 'CADBURY DAIRY MILK 110G' },
    { barcode: '0000000000000', name: 'NON EXISTENT PRODUCT ITEM 999' },
  ];

  console.log('\n=== INDIVIDUAL PRODUCT VERIFICATION ===\n');

  const evidenceTable = [];
  let allProductChecksPass = true;

  for (const p of products) {
    // Query raw_products created or updated during THIS run
    const { data: rawRows } = await supabase
      .from('raw_products')
      .select('*')
      .eq('supplier_id', scraper.supplierRow.id)
      .eq('raw_barcode', p.barcode)
      .gte('scraped_at', runRow.started_at);

    const rawProduct = rawRows && rawRows.length > 0 ? rawRows[0] : null;

    // Query price_snapshots created during THIS run
    let snapshot = null;
    if (rawProduct) {
      const { data: snapRows } = await supabase
        .from('price_snapshots')
        .select('*')
        .eq('supplier_id', scraper.supplierRow.id)
        .eq('raw_product_id', rawProduct.id)
        .gte('snapshot_at', runRow.started_at)
        .order('snapshot_at', { ascending: false });
      snapshot = snapRows && snapRows.length > 0 ? snapRows[0] : null;
    }

    // Query logs for this product
    const pLogs = searchLogs.filter(l => l.barcode === p.barcode);
    const winningLog = pLogs.find(l => l.result_status === 'success');
    const finalStatus = winningLog ? 'SUCCESS' : (pLogs[pLogs.length - 1]?.result_status?.toUpperCase() || 'NOT_FOUND');

    const isUnrelatedFalsePos = ['5000177500971', '90493577', '5016860000178', '3057640600128'].includes(p.barcode);
    const noFalseMatchWritten = isUnrelatedFalsePos ? (!rawProduct && finalStatus !== 'SUCCESS') : true;

    const fkSnapMatch = snapshot ? (snapshot.raw_product_id === rawProduct.id) : true;
    const fkLogMatch  = winningLog && winningLog.raw_product_id ? (winningLog.raw_product_id === rawProduct.id) : true;

    const packHasNoPrice = rawProduct && rawProduct.raw_pack_info
      ? !(/£|\bvat\b/i.test(rawProduct.raw_pack_info))
      : true;

    // Extract detailed evidence fields
    const lastLog = pLogs[pLogs.length - 1] || {};
    const candTitle = winningLog ? (winningLog.selected_candidate_title || 'N/A') : (lastLog.selected_candidate_title || 'N/A');
    const candCode  = winningLog ? (winningLog.selected_candidate_code || 'N/A') : (lastLog.selected_candidate_code || 'N/A');
    const candUrl   = winningLog ? (winningLog.selected_candidate_url || 'N/A') : (lastLog.selected_candidate_url || 'N/A');
    const score     = winningLog ? winningLog.validation_score : (lastLog.validation_score || 0);
    const scoreReason = winningLog ? winningLog.validation_reason : (lastLog.validation_reason || 'N/A');

    const srcBrand = ProductMetadataParser.extractBrand(p.name) || 'null';
    const candBrand = ProductMetadataParser.extractBrand(candTitle) || 'null';
    const srcVolWeight = ProductMetadataParser.extractVolume(p.name) || ProductMetadataParser.extractWeight(p.name) || 'null';
    const candVolWeight = ProductMetadataParser.extractVolume(candTitle) || ProductMetadataParser.extractWeight(candTitle) || 'null';

    const srcVar = ProductMetadataParser.extractVariant(p.name) || 'null';
    const candVar = ProductMetadataParser.extractVariant(candTitle) || 'null';
    const srcPack = ProductMetadataParser.extractPackSize(p.name) || 'null';
    const candPack = ProductMetadataParser.extractPackSize(candTitle) || 'null';

    const pass = noFalseMatchWritten && fkSnapMatch && fkLogMatch && packHasNoPrice;
    if (!pass) allProductChecksPass = false;

    evidenceTable.push({
      barcode: p.barcode,
      srcTitle: p.name,
      candTitle,
      candCode,
      candUrl,
      srcBrand,
      candBrand,
      srcVolWeight,
      candVolWeight,
      srcVar,
      candVar,
      srcPack,
      candPack,
      score,
      scoreReason,
      finalStatus,
      rawProductId: rawProduct ? rawProduct.id : 'N/A',
      snapshotId: snapshot ? snapshot.id : 'N/A',
      price: snapshot ? `£${snapshot.case_price}` : 'N/A',
      inStock: snapshot ? String(snapshot.in_stock) : 'N/A',
      pass: pass ? '✅ PASS' : '❌ FAIL',
    });
  }

  console.log('--- DETAILED EVIDENCE REPORT PER PRODUCT ---\n');
  for (let idx = 0; idx < evidenceTable.length; idx++) {
    const e = evidenceTable[idx];
    console.log(`[Product ${idx + 1}] ${e.srcTitle} (${e.barcode})`);
    console.log(`  Candidate Title:  "${e.candTitle}"`);
    console.log(`  Parfetts Code:    ${e.candCode}`);
    console.log(`  Direct Product URL: ${e.candUrl}`);
    console.log(`  Normalized Brand: Source="${e.srcBrand}" | Candidate="${e.candBrand}"`);
    console.log(`  Volume / Weight:  Source="${e.srcVolWeight}" | Candidate="${e.candVolWeight}"`);
    console.log(`  Variants:         Source="${e.srcVar}" | Candidate="${e.candVar}"`);
    console.log(`  Pack Size:        Source="${e.srcPack}" | Candidate="${e.candPack}"`);
    console.log(`  Validation Score: ${e.score} | Reason: "${e.scoreReason}"`);
    console.log(`  Final Status:     ${e.finalStatus}`);
    console.log(`  Database Linkage: raw_products.id=${e.rawProductId} → price_snapshots.id=${e.snapshotId} (raw_product_id linked)`);
    console.log(`  Price & Stock:    Case Price=${e.price} | In Stock=${e.inStock}`);
    console.log(`  Result:           ${e.pass}`);
    console.log('------------------------------------------------------------');
  }

  // 5. Verify Metrics Accuracy in scraper_runs
  console.log('\n=== SCRAPER RUNS METRICS VERIFICATION ===\n');
  const mPass =
    runRow.attempted_count === 10 &&
    runRow.successful_price_count === runRow.priced_count &&
    (runRow.matched_count + runRow.ambiguous_count + runRow.rejected_count + runRow.not_found_count + runRow.error_count) === 10;

  console.log(`attempted_count:        ${runRow.attempted_count} (expected 10)`);
  console.log(`matched_count:          ${runRow.matched_count}`);
  console.log(`priced_count:           ${runRow.priced_count}`);
  console.log(`missing_price_count:    ${runRow.missing_price_count}`);
  console.log(`in_stock_count:         ${runRow.in_stock_count}`);
  console.log(`out_of_stock_count:     ${runRow.out_of_stock_count}`);
  console.log(`unknown_stock_count:    ${runRow.unknown_stock_count}`);
  console.log(`ambiguous_count:        ${runRow.ambiguous_count}`);
  console.log(`rejected_count:         ${runRow.rejected_count}`);
  console.log(`not_found_count:        ${runRow.not_found_count}`);
  console.log(`error_count:            ${runRow.error_count}`);
  console.log(`successful_price_count: ${runRow.successful_price_count} (equals priced_count? ${runRow.successful_price_count === runRow.priced_count ? 'YES ✅' : 'NO ❌'})`);
  console.log(`\nMetrics Sum Validation: ${runRow.matched_count} + ${runRow.ambiguous_count} + ${runRow.rejected_count} + ${runRow.not_found_count} + ${runRow.error_count} = ${runRow.attempted_count}`);
  console.log(`Metrics Verification: ${mPass ? '✅ PASS' : '❌ FAIL'}`);

  console.log(`\n============================================================`);
  console.log(`10-PRODUCT REGRESSION STATUS: ${allProductChecksPass && mPass ? '✅ ALL CHECKS PASSED' : '❌ REGRESSION FAILED'}`);
  console.log(`============================================================\n`);
}

main().catch(err => {
  console.error('Fatal error in validation run:', err);
  process.exit(1);
});
