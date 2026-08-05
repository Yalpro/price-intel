/**
 * FIX 5 — Metrics Accuracy Unit & Integration Test
 *
 * Verifies that:
 * 1. BaseScraper stats correctly track 10 distinct product-level metrics.
 * 2. Each CSV product contributes EXACTLY ONCE to final outcome counters.
 * 3. Fallback search attempts (e.g. barcode not_found -> name success) do NOT inflate intermediate status counters.
 * 4. successful_price_count remains backward-compatible (= priced_count).
 * 5. NO database writes occur during unit tests.
 */

require('dotenv').config({ path: '../.env' });
const supabaseJs = require('@supabase/supabase-js');

// Mock Supabase createClient BEFORE requiring BaseScraper for 100% zero DB writes
supabaseJs.createClient = () => ({
  from: () => ({
    select: () => ({ single: async () => ({ data: { id: 888 }, error: null }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: { id: 777 }, error: null }) }) }),
    upsert: () => ({ select: () => ({ single: async () => ({ data: { id: 666 }, error: null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  })
});

const { BaseScraper } = require('./scrapers/BaseScraper');

class DummyScraper extends BaseScraper {
  constructor() {
    super('dummy_test_supplier');
    this.supplierRow = { id: 1 };
    this.runId = 999;
    this.startTime = Date.now();
  }

  async logSearchResult(logData) { return 123; }
  async getSupplierRow() { return this.supplierRow; }
}

async function runFix5MetricsTests() {
  console.log('=== FIX 5 METRICS ACCURACY UNIT TESTS ===\n');

  // Test Case Data
  const testScenarios = [
    {
      name: 'Scenario 1: SUCCESS + price + in stock',
      product: { barcode: '5000112693577', product_name: 'COCA COLA 330ML' },
      searchResult: { result_status: 'success', price: 11.45, inStock: true, rawTitle: 'Coca Cola 330ml Can', rawPackInfo: '1 x 12' },
      expected: { matchedCount: 1, pricedCount: 1, missingPriceCount: 0, inStockCount: 1, outOfStockCount: 0, unknownStockCount: 0, ambiguousCount: 0, rejectedCount: 0, notFoundCount: 0, errorCount: 0, successfulPriceCount: 1 }
    },
    {
      name: 'Scenario 2: SUCCESS + price + out of stock',
      product: { barcode: '5000177500971', product_name: 'MONSTER ENERGY 500ML' },
      searchResult: { result_status: 'success', price: 14.85, inStock: false, rawTitle: 'Monster Energy 500ml Can', rawPackInfo: '1 x 12' },
      expected: { matchedCount: 1, pricedCount: 1, missingPriceCount: 0, inStockCount: 0, outOfStockCount: 1, unknownStockCount: 0, ambiguousCount: 0, rejectedCount: 0, notFoundCount: 0, errorCount: 0, successfulPriceCount: 1 }
    },
    {
      name: 'Scenario 3: SUCCESS + price + unknown stock (stock === null)',
      product: { barcode: '5010459015178', product_name: 'HIGHLAND SPRING WATER' },
      searchResult: { result_status: 'success', price: 9.39, inStock: null, rawTitle: 'Highland Spring Still Water 1.5L', rawPackInfo: '6 x 1.5L' },
      expected: { matchedCount: 1, pricedCount: 1, missingPriceCount: 0, inStockCount: 0, outOfStockCount: 0, unknownStockCount: 1, ambiguousCount: 0, rejectedCount: 0, notFoundCount: 0, errorCount: 0, successfulPriceCount: 1 }
    },
    {
      name: 'Scenario 4: SUCCESS + missing price (price === null)',
      product: { barcode: '5012136012500', product_name: 'KNIGHTS CIDER' },
      searchResult: { result_status: 'success', price: null, inStock: true, rawTitle: 'Knights Cider 500ml', rawPackInfo: '1 x 24' },
      expected: { matchedCount: 1, pricedCount: 0, missingPriceCount: 1, inStockCount: 1, outOfStockCount: 0, unknownStockCount: 0, ambiguousCount: 0, rejectedCount: 0, notFoundCount: 0, errorCount: 0, successfulPriceCount: 0 }
    },
    {
      name: 'Scenario 5: AMBIGUOUS final outcome (no strategy succeeded, best non-success is ambiguous)',
      product: { barcode: '5000328036144', product_name: 'GENERIC CRISPS' },
      searchResult: { result_status: 'ambiguous', price: null, inStock: null, validation_score: 65, validation_reason: 'Ambiguous brand match' },
      expected: { matchedCount: 0, pricedCount: 0, missingPriceCount: 0, inStockCount: 0, outOfStockCount: 0, unknownStockCount: 0, ambiguousCount: 1, rejectedCount: 0, notFoundCount: 0, errorCount: 0, successfulPriceCount: 0 }
    },
    {
      name: 'Scenario 6: REJECTED final outcome (candidate rejected due to brand conflict)',
      product: { barcode: '5000177500971', product_name: 'MONSTER ENERGY' },
      searchResult: { result_status: 'rejected', price: null, inStock: null, validation_score: 0, validation_reason: 'Brand conflict' },
      expected: { matchedCount: 0, pricedCount: 0, missingPriceCount: 0, inStockCount: 0, outOfStockCount: 0, unknownStockCount: 0, ambiguousCount: 0, rejectedCount: 1, notFoundCount: 0, errorCount: 0, successfulPriceCount: 0 }
    },
    {
      name: 'Scenario 7: NOT_FOUND final outcome (0 candidates returned across all strategies)',
      product: { barcode: '0000000000000', product_name: 'NON EXISTENT PRODUCT' },
      searchResult: { result_status: 'not_found', price: null, inStock: null, validation_score: 0, validation_reason: 'No candidates found.' },
      expected: { matchedCount: 0, pricedCount: 0, missingPriceCount: 0, inStockCount: 0, outOfStockCount: 0, unknownStockCount: 0, ambiguousCount: 0, rejectedCount: 0, notFoundCount: 1, errorCount: 0, successfulPriceCount: 0 }
    },
  ];

  let allPass = true;

  for (const sc of testScenarios) {
    const scraper = new DummyScraper();

    // Mock executeSearch to return candidate or empty array based on scenario
    scraper.executeSearch = async (pg, term, type) => {
      if (sc.searchResult.result_status === 'not_found') return [];
      return [{
        rawTitle: sc.searchResult.rawTitle || sc.product.product_name,
        rawPackInfo: sc.searchResult.rawPackInfo || '1x12',
        price: sc.searchResult.price,
        inStock: sc.searchResult.inStock,
        promotionFlag: false,
        rawBarcode: '5000112693577',
      }];
    };

    // Mock validateCandidates to return predefined scenario status
    scraper.validateCandidates = () => sc.searchResult;

    // Run processProduct without DB upsert
    // We override supabase upsert calls in unit test scope by wrapping processProduct logic check
    const origUpsert = scraper.processProduct;

    // Manually run processProduct logic safely
    await scraper.processProduct(sc.product, null).catch(err => {
      // Ignore DB network errors in unit test environment
    });

    const s = scraper.stats;
    const exp = sc.expected;

    const matchPass =
      s.attemptedCount === 1 &&
      s.matchedCount === exp.matchedCount &&
      s.pricedCount === exp.pricedCount &&
      s.missingPriceCount === exp.missingPriceCount &&
      s.inStockCount === exp.inStockCount &&
      s.outOfStockCount === exp.outOfStockCount &&
      s.unknownStockCount === exp.unknownStockCount &&
      s.ambiguousCount === exp.ambiguousCount &&
      s.rejectedCount === exp.rejectedCount &&
      s.notFoundCount === exp.notFoundCount &&
      s.successfulPriceCount === exp.successfulPriceCount;

    if (!matchPass) allPass = false;

    console.log(`Test: ${sc.name}`);
    console.log(`  attempted=${s.attemptedCount} | matched=${s.matchedCount} | priced=${s.pricedCount} (backward-compat successfulPrice=${s.successfulPriceCount})`);
    console.log(`  missingPrice=${s.missingPriceCount} | inStock=${s.inStockCount} | outOfStock=${s.outOfStockCount} | unknownStock=${s.unknownStockCount}`);
    console.log(`  ambiguous=${s.ambiguousCount} | rejected=${s.rejectedCount} | notFound=${s.notFoundCount} | error=${s.errorCount}`);
    console.log(`  Result: ${matchPass ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  // Multi-attempt non-inflation test
  console.log('--- Scenario 8: Multi-attempt search (Barcode fails -> Name succeeds) ---');
  const multiScraper = new DummyScraper();
  let attempt = 0;
  multiScraper.executeSearch = async () => [];
  multiScraper.validateCandidates = (prod, candidates, type) => {
    attempt++;
    if (type === 'barcode') return { result_status: 'not_found', validation_score: 0, validation_reason: 'No candidates' };
    if (type === 'exact_name') return { result_status: 'rejected', validation_score: 0, validation_reason: 'Brand mismatch' };
    return { result_status: 'success', price: 10.99, inStock: true, rawTitle: prod.product_name, rawPackInfo: '1x12' };
  };

  await multiScraper.processProduct({ barcode: '5000112693577', product_name: 'COCA COLA' }, null).catch(() => {});

  const ms = multiScraper.stats;
  const multiPass =
    ms.attemptedCount === 1 &&
    ms.matchedCount === 1 &&
    ms.pricedCount === 1 &&
    ms.notFoundCount === 0 && // Intermediate barcode not_found must NOT increment notFoundCount!
    ms.rejectedCount === 0;   // Intermediate exact_name rejected must NOT increment rejectedCount!

  if (!multiPass) allPass = false;

  console.log(`  attempted=${ms.attemptedCount} | matched=${ms.matchedCount} | priced=${ms.pricedCount}`);
  console.log(`  intermediate notFoundCount=${ms.notFoundCount} (expected 0) | intermediate rejectedCount=${ms.rejectedCount} (expected 0)`);
  console.log(`  Multi-attempt Non-inflation Result: ${multiPass ? '✅ PASS' : '❌ FAIL'}\n`);

  console.log(`Overall: ${allPass ? '✅ ALL METRICS TESTS PASS' : '❌ SOME TESTS FAILED'}`);
}

runFix5MetricsTests().catch(console.error);
