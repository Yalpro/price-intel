/**
 * Parfetts Functional Matching Unit Test Suite
 *
 * Verifies volume normalization, pack extraction fix, variant conflict detection,
 * safe SUCCESS scoring rules, multi-supplier safety, and positive/negative Parfetts matching cases.
 *
 * Runs 100% in-memory with 0 DB writes.
 */

require('dotenv').config({ path: '../.env' });
const ProductMetadataParser = require('./utils/ProductMetadataParser');
const { BaseScraper } = require('./scrapers/BaseScraper');

class DummyScraper extends BaseScraper {
  constructor(supplierName) {
    super(supplierName);
  }
}

function runTests() {
  console.log('=== PARFETTS FUNCTIONAL MATCHING UNIT TESTS ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failures++;
    }
  }

  // ------------------------------------------------------------
  // SECTION 1: VOLUME NORMALIZATION TESTS
  // ------------------------------------------------------------
  console.log('--- 1. Volume Normalization Tests ---');
  const v1 = ProductMetadataParser.extractVolume('HIGHLAND SPRING STILL WATER 1.5L');
  const v2 = ProductMetadataParser.extractVolume('Highland Spring Still Water 1.5LTR');
  const v3 = ProductMetadataParser.extractVolume('Highland Spring Still Water 1.5 litre');
  const v4 = ProductMetadataParser.extractVolume('Highland Spring 1500ml');
  const v5 = ProductMetadataParser.extractVolume('Coca Cola 500ml');
  const v6 = ProductMetadataParser.extractVolume('Coca Cola 330ml');

  assert(v1 === '1.5l', `1.5L extracted as "1.5l" (got "${v1}")`);
  assert(v2 === '1.5l', `1.5LTR normalized to "1.5l" (got "${v2}")`);
  assert(v3 === '1.5l', `1.5 litre normalized to "1.5l" (got "${v3}")`);
  assert(v4 === '1.5l', `1500ml converted to "1.5l" (got "${v4}")`);
  assert(v1 === v2, '1.5L vs 1.5LTR -> MATCH');
  assert(v1 === v3, '1.5L vs 1.5 litre -> MATCH');
  assert(v1 !== v5, '1.5L vs 500ml -> CONFLICT');
  assert(v6 !== v5, '330ml vs 500ml -> CONFLICT');

  // ------------------------------------------------------------
  // SECTION 2: ISSUE 1 OUTCOME CLASSIFICATION TESTS
  // ------------------------------------------------------------
  console.log('\n--- 2. Issue 1 Outcome Classification Tests ---');
  const scraper = new DummyScraper('test_supplier');

  const zeroCandResult = scraper.validateCandidates(
    { product_name: 'NON EXISTENT PRODUCT ITEM 999' },
    [],
    'exact_name'
  );
  assert(zeroCandResult.result_status === 'not_found', 'Zero candidates -> NOT_FOUND');

  const noMetaMatchResult = scraper.validateCandidates(
    { product_name: 'NON EXISTENT PRODUCT ITEM 999' },
    [{ rawTitle: 'Item 123 999' }],
    'exact_name'
  );
  assert(noMetaMatchResult.result_status === 'not_found', 'Candidates with no metadata match -> NOT_FOUND');

  const conflictResult = scraper.validateCandidates(
    { product_name: 'COCA COLA 500ML' },
    [{ rawTitle: 'Coca Cola 330ml' }],
    'exact_name'
  );
  assert(conflictResult.result_status === 'rejected', 'Conflicting metadata candidate -> REJECTED');

  const tieResult = scraper.validateCandidates(
    { product_name: 'COCA COLA ENERGY 250ML' },
    [
      { rawTitle: 'Coca Cola Energy Sugar Free 250ml' },
      { rawTitle: 'Coca Cola Energy Cherry 250ml' }
    ],
    'exact_name'
  );
  assert(tieResult.result_status === 'ambiguous', 'Tied plausible candidates -> AMBIGUOUS');

  // ------------------------------------------------------------
  // SECTION 3: VARIANT / FLAVOUR DETECTION TESTS
  // ------------------------------------------------------------
  console.log('\n--- 3. Variant / Flavour Detection Tests ---');
  const varResult1 = scraper.evaluateCandidate(
    { product_name: 'COCA COLA LIME PM £1.85 500ML' },
    { rawTitle: 'Coca Cola Cherry Float Pm £1.79 500ML' }
  );
  assert(varResult1.result_status === 'rejected', 'Coca Cola Lime vs Coca Cola Cherry Float -> REJECTED');

  const varResult2 = scraper.evaluateCandidate(
    { product_name: 'MONSTER ENERGY ORIGINAL 500ML' },
    { rawTitle: 'Monster Energy Mango Loco 500ml' }
  );
  assert(varResult2.result_status === 'rejected', 'Monster Original vs Monster Mango Loco -> REJECTED');

  const varResult3 = scraper.evaluateCandidate(
    { product_name: 'COCA COLA ORIGINAL 330ML' },
    { rawTitle: 'Coca Cola 330ml Can' }
  );
  assert(varResult3.result_status !== 'rejected', 'Coca Cola Original vs Coca Cola (no variant) -> NOT REJECTED');

  const varResult4 = scraper.evaluateCandidate(
    { product_name: 'HIGHLAND SPRING STILL WATER 1.5L' },
    { rawTitle: 'Highland Spring Sparkling Water 1.5L' }
  );
  assert(varResult4.result_status === 'rejected', 'Highland Spring Still vs Sparkling -> REJECTED');

  const varResult5 = scraper.evaluateCandidate(
    { product_name: 'COCA COLA LIME 500ML' },
    { rawTitle: 'Coca Cola Lime 500ML' }
  );
  assert(varResult5.result_status === 'success', 'Same explicit variant Lime vs Lime -> MATCH (SUCCESS)');

  // ------------------------------------------------------------
  // SECTION 4: PARFETTS GENUINE SUCCESS MATCHES (AT LEAST 5)
  // ------------------------------------------------------------
  console.log('\n--- 4. Parfetts Genuine SUCCESS Matches (5/5) ---');

  const match1 = scraper.evaluateCandidate(
    { product_name: 'COCA COLA ORIGINAL TASTE 330ML' },
    { rawTitle: 'Coca Cola Original Taste 24 x 330ml Can' }
  );
  assert(match1.result_status === 'success' && match1.validation_score >= 90, '1. Coca-Cola 330ml Can -> SUCCESS (Score >= 90)');

  const match2 = scraper.evaluateCandidate(
    { product_name: 'MONSTER ENERGY ORIGINAL 500ML' },
    { rawTitle: 'Monster Energy Original 12 x 500ml Can' }
  );
  assert(match2.result_status === 'success' && match2.validation_score >= 90, '2. Monster Energy 500ml -> SUCCESS (Score >= 90)');

  const match3 = scraper.evaluateCandidate(
    { product_name: 'HIGHLAND SPRING STILL WATER 1.5L' },
    { rawTitle: 'Highland Spring Still Water 1.5LTR' }
  );
  assert(match3.result_status === 'success' && match3.validation_score >= 90, '3. Highland Spring 1.5L vs 1.5LTR -> SUCCESS (Score >= 90)');

  const match4 = scraper.evaluateCandidate(
    { product_name: 'CADBURY DAIRY MILK 110G' },
    { rawTitle: 'Cadbury Dairy Milk Bar 110g' }
  );
  assert(match4.result_status === 'success' && match4.validation_score >= 90, '4. Cadbury Dairy Milk 110g -> SUCCESS (Score >= 90)');

  const match5 = scraper.evaluateCandidate(
    { product_name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P' },
    { rawTitle: 'Go Local Sensitive Baby Wipes PM 89p 54s' }
  );
  assert(match5.result_status === 'success' && match5.validation_score >= 90, '5. Go Local Baby Wipes -> SUCCESS (Score >= 90)');

  // ------------------------------------------------------------
  // SECTION 5: SAFETY REJECTION CASES
  // ------------------------------------------------------------
  console.log('\n--- 5. Safety Rejection Cases ---');

  const rej1 = scraper.evaluateCandidate(
    { barcode: '5000177500971', product_name: 'MONSTER ENERGY ORIGINAL 500ML' },
    { rawBarcode: '123190', rawTitle: 'Go Local Sensitive Baby Wipes Pm 89p 54s' },
    'barcode'
  );
  assert(rej1.result_status === 'rejected', 'Monster Energy vs Baby Wipes -> REJECTED (Zero Contamination)');

  const rej2 = scraper.evaluateCandidate(
    { product_name: 'COCA COLA 500ML' },
    { rawTitle: 'Coca Cola 330ml' }
  );
  assert(rej2.result_status === 'rejected', 'Volume mismatch 500ml vs 330ml -> REJECTED');

  // ------------------------------------------------------------
  // SECTION 6: MULTI-SUPPLIER REGRESSION SAFETY
  // ------------------------------------------------------------
  console.log('\n--- 6. Multi-Supplier Regression Safety (Booker, Bestway, Costco) ---');
  const bookerScraper = new DummyScraper('booker');
  const bestwayScraper = new DummyScraper('bestway');
  const costcoScraper = new DummyScraper('costco');

  const bMatch = bookerScraper.evaluateCandidate(
    { product_name: 'COCA COLA ORIGINAL 330ML' },
    { rawTitle: 'Coca Cola Original Taste 24 x 330ml Can' }
  );
  assert(bMatch.result_status === 'success', 'Booker scraper Coca Cola -> SUCCESS');

  const bwMatch = bestwayScraper.evaluateCandidate(
    { product_name: 'MONSTER ENERGY ORIGINAL 500ML' },
    { rawTitle: 'Monster Energy Original 12 x 500ml' }
  );
  assert(bwMatch.result_status === 'success', 'Bestway scraper Monster Energy -> SUCCESS');

  const cMatch = costcoScraper.evaluateCandidate(
    { product_name: 'HIGHLAND SPRING STILL WATER 1.5L' },
    { rawTitle: 'Highland Spring Still Water 1.5L' }
  );
  assert(cMatch.result_status === 'success', 'Costco scraper Highland Spring -> SUCCESS');

  console.log('\n============================================================');
  console.log(`UNIT TESTS COMPLETED: ${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} FAILURES`}`);
  console.log('============================================================\n');

  if (failures > 0) process.exit(1);
}

runTests();
