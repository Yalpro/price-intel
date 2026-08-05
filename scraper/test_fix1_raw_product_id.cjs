/**
 * FIX 1 Isolated Test — verify raw_product_id linkage
 *
 * Tests with 2 known Booker products from the Top 1000 catalogue
 * (using Booker because it already has working session state and
 * reliably produces successes — this isolates the FIX 1 DB linkage
 * logic from any Parfetts-specific scraper issues).
 *
 * Pre-conditions:
 *   1. Run the migration SQL first:
 *      supabase/migrations/00000000000010_add_raw_product_id_to_price_snapshots.sql
 *   2. Confirm `price_snapshots.raw_product_id` column now exists before running this test.
 *
 * Expected evidence to collect:
 *   - raw_products.id for each test product
 *   - price_snapshots.id and price_snapshots.raw_product_id for each snapshot
 *   - product_search_logs.id and product_search_logs.raw_product_id for each success log
 *   - Verify: price_snapshots.raw_product_id === raw_products.id (exact FK match)
 *   - Verify: product_search_logs.raw_product_id === raw_products.id (exact FK match)
 *   - Verify: each price_snapshots row links to EXACTLY ONE raw_products row
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// STEP 0: Confirm price_snapshots.raw_product_id column exists
// ============================================================
async function confirmSchemaReady() {
  const { data, error } = await supabase
    .from('price_snapshots')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('[Pre-check] Cannot read price_snapshots:', error.message);
    return false;
  }

  const cols = Object.keys(data);
  if (!cols.includes('raw_product_id')) {
    console.error('\n❌ PRE-CHECK FAILED: price_snapshots does NOT have raw_product_id column.');
    console.error('   Run the migration SQL first:');
    console.error('   supabase/migrations/00000000000010_add_raw_product_id_to_price_snapshots.sql');
    return false;
  }

  console.log('✅ Pre-check passed: price_snapshots.raw_product_id column confirmed.');
  console.log('   Columns:', cols.join(', '));
  return true;
}

// ============================================================
// STEP 1: Simulate what BaseScraper.processProduct now does
// Test with 2 known products (real Booker data, supplier_id = 1)
// ============================================================
const TEST_PRODUCTS = [
  {
    barcode: '5000112693577',
    product_name: 'COCA COLA £1.15',
    simulatedSupplierTitle: 'Coca-Cola Original Taste PM £1.15 330ml Can',
    simulatedPackInfo: 'Case of 24 x 330ml',
    simulatedPrice: 11.45,
    simulatedInStock: true,
    simulatedPromo: false,
  },
  {
    barcode: '5056784914151',
    product_name: 'MONSTER ULTRA',
    simulatedSupplierTitle: 'Monster Energy Drink Ultra 500ml PM £1.75 Can',
    simulatedPackInfo: 'Case of 12 x 500ml',
    simulatedPrice: 14.85,
    simulatedInStock: true,
    simulatedPromo: false,
  },
];

const SUPPLIER_ID = 1; // Booker
const FAKE_RUN_ID = 9999; // Isolated test — does not touch real scraper_runs

async function runFix1Test() {
  console.log('\n=== FIX 1 ISOLATED TEST: raw_product_id Linkage ===\n');

  const schemaOk = await confirmSchemaReady();
  if (!schemaOk) {
    process.exit(1);
  }

  const evidence = [];

  for (const product of TEST_PRODUCTS) {
    console.log(`\n--- Testing: ${product.product_name} (${product.barcode}) ---`);
    const now = new Date().toISOString();

    // ---- 1. Upsert raw_products (mirrors BaseScraper.processProduct) ----
    const { data: rawProduct, error: rawError } = await supabase
      .from('raw_products')
      .upsert(
        {
          supplier_id: SUPPLIER_ID,
          raw_title: product.simulatedSupplierTitle,
          raw_barcode: product.barcode,
          raw_pack_info: product.simulatedPackInfo,
          scraped_at: now,
        },
        { onConflict: 'supplier_id,raw_barcode' }
      )
      .select()
      .single();

    if (rawError) {
      console.error(`  ❌ raw_products upsert failed:`, rawError.message);
      continue;
    }
    console.log(`  ✅ raw_products.id = ${rawProduct.id}`);

    // ---- 2. Insert product_search_logs (mirrors BaseScraper.logSearchResult) ----
    const { data: logData, error: logError } = await supabase
      .from('product_search_logs')
      .insert({
        scraper_run_id: null,           // isolated test — no real run
        supplier_id: SUPPLIER_ID,
        source_catalogue_key: product.barcode,
        barcode: product.barcode,
        original_product_name: product.product_name,
        attempt_number: 1,
        search_strategy: 'barcode',
        searched_term: product.barcode,
        result_status: 'success',
        validation_score: 90,
        validation_reason: 'FIX 1 test entry',
        matched_supplier_product_title: product.simulatedSupplierTitle,
        matched_supplier_barcode: null,
        candidate_count: 1,
        search_duration_ms: 0,
        error_message: null,
      })
      .select('id')
      .single();

    if (logError) {
      console.error(`  ❌ product_search_logs insert failed:`, logError.message);
      continue;
    }
    console.log(`  ✅ product_search_logs.id = ${logData.id}`);

    // ---- 3. Insert price_snapshots WITH raw_product_id (FIX 1) ----
    const { data: snapData, error: snapError } = await supabase
      .from('price_snapshots')
      .insert({
        canonical_product_id: null,
        supplier_id: SUPPLIER_ID,
        raw_product_id: rawProduct.id,   // ← THE FIX
        case_price: product.simulatedPrice,
        unit_cost: null,
        in_stock: product.simulatedInStock,
        promotion_flag: product.simulatedPromo,
        snapshot_at: now,
      })
      .select('id, raw_product_id')
      .single();

    if (snapError) {
      console.error(`  ❌ price_snapshots insert failed:`, snapError.message);
      if (snapError.message.includes('raw_product_id')) {
        console.error('  → Column raw_product_id does not exist. Run the migration SQL first.');
      }
      continue;
    }
    console.log(`  ✅ price_snapshots.id = ${snapData.id}, raw_product_id = ${snapData.raw_product_id}`);

    // ---- 4. Backfill product_search_logs.raw_product_id (FIX 1) ----
    const { error: backfillErr } = await supabase
      .from('product_search_logs')
      .update({ raw_product_id: rawProduct.id })
      .eq('id', logData.id);

    if (backfillErr) {
      console.error(`  ❌ product_search_logs backfill failed:`, backfillErr.message);
    } else {
      console.log(`  ✅ product_search_logs.id=${logData.id} → raw_product_id = ${rawProduct.id} backfilled`);
    }

    evidence.push({
      product_name: product.product_name,
      barcode: product.barcode,
      raw_products_id: rawProduct.id,
      price_snapshots_id: snapData.id,
      price_snapshots_raw_product_id: snapData.raw_product_id,
      product_search_logs_id: logData.id,
      link_correct: snapData.raw_product_id === rawProduct.id,
    });
  }

  // ============================================================
  // STEP 2: Verify JOIN works — each snapshot links to exactly 1 product
  // ============================================================
  console.log('\n=== VERIFICATION: price_snapshots JOIN raw_products ===\n');

  for (const e of evidence) {
    const { data: verifySnap } = await supabase
      .from('price_snapshots')
      .select('id, raw_product_id, case_price, in_stock, snapshot_at')
      .eq('id', e.price_snapshots_id)
      .single();

    const { data: verifyRaw } = await supabase
      .from('raw_products')
      .select('id, raw_barcode, raw_title, raw_pack_info')
      .eq('id', e.raw_products_id)
      .single();

    const { data: verifyLog } = await supabase
      .from('product_search_logs')
      .select('id, raw_product_id, barcode, result_status, validation_score')
      .eq('id', e.product_search_logs_id)
      .single();

    const snapshotLinksToCorrectProduct = verifySnap?.raw_product_id === verifyRaw?.id;
    const logLinksToCorrectProduct = verifyLog?.raw_product_id === verifyRaw?.id;

    console.log(`Product: ${e.product_name} (${e.barcode})`);
    console.log(`  raw_products:        id=${verifyRaw?.id} | barcode=${verifyRaw?.raw_barcode} | title="${verifyRaw?.raw_title}"`);
    console.log(`  price_snapshots:     id=${verifySnap?.id} | raw_product_id=${verifySnap?.raw_product_id} | price=£${verifySnap?.case_price} | in_stock=${verifySnap?.in_stock}`);
    console.log(`  product_search_logs: id=${verifyLog?.id} | raw_product_id=${verifyLog?.raw_product_id} | status=${verifyLog?.result_status}`);
    console.log(`  ✅ Snapshot FK correct: ${snapshotLinksToCorrectProduct}`);
    console.log(`  ✅ Log FK correct:       ${logLinksToCorrectProduct}`);

    if (!snapshotLinksToCorrectProduct || !logLinksToCorrectProduct) {
      console.error(`  ❌ LINKAGE FAILURE for ${e.product_name}`);
    }
    console.log();
  }

  // ============================================================
  // STEP 3: Confirm no orphaned snapshots (raw_product_id = null) 
  //         were created in this test session
  // ============================================================
  console.log('=== VERIFICATION: No null raw_product_id in test snapshots ===');
  for (const e of evidence) {
    const nullCheck = e.price_snapshots_raw_product_id === null;
    console.log(`  ${e.product_name}: raw_product_id = ${e.price_snapshots_raw_product_id} → ${nullCheck ? '❌ NULL (FAIL)' : '✅ Populated (PASS)'}`);
  }

  console.log('\n=== FIX 1 TEST COMPLETE ===');
  console.log('Evidence JSON:');
  console.log(JSON.stringify(evidence, null, 2));
}

runFix1Test().catch(console.error);
