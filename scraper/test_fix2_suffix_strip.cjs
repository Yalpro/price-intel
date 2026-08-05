/**
 * FIX 2 Follow-up Regression Test — near-exact title match via suffix strip
 *
 * Tests that:
 *   1. Genuine Baby Wipes reaches SUCCESS via name-based strategy
 *   2. All 4 false-positive products remain REJECTED against Baby Wipes
 *   3. A genuinely different Baby Wipes variant does NOT get forced to SUCCESS
 *   4. A conflicting pack count (24s vs 54s) does NOT match
 *
 * No DB writes. No browser. Pure logic using live module code.
 */

'use strict';

const P = require('./utils/ProductMetadataParser.js');

// ── Inline copy of evaluateCandidate (matches current BaseScraper.js) ────────
function evaluateCandidate(csvProduct, candidate, strategy) {
  const csvBarcode       = P.normalizeBarcode(csvProduct.barcode);
  const candidateBarcode = P.normalizeBarcode(candidate.rawBarcode);

  if (csvBarcode && candidateBarcode) {
    if (csvBarcode === candidateBarcode) {
      return { result_status: 'success', validation_score: 100, validation_reason: 'Exact normalized barcode match.' };
    } else if (candidateBarcode.length > 7) {
      return { result_status: 'rejected', validation_score: 0, validation_reason: `Conflicting barcode: Expected ${csvBarcode}, got ${candidateBarcode}.`, conflicting_fields: 'barcode' };
    }
  }

  const csvName  = csvProduct.product_name;
  const candName = candidate.rawTitle || '';

  const csvBrand  = P.extractBrand(csvName);
  const candBrand = P.extractBrand(candName);
  const csvVol    = P.extractVolume(csvName);
  const candVol   = P.extractVolume(candName);
  const csvWeight = P.extractWeight(csvName);
  const candWeight= P.extractWeight(candName);
  const csvPack   = P.extractPackSize(csvName);
  const candPack  = P.extractPackSize(candName) || P.extractPackSize(candidate.rawPackInfo);

  const conflicts = [];
  const matched   = [];

  if (csvBrand  && candBrand  && csvBrand  !== candBrand)  conflicts.push('brand');
  if (csvVol    && candVol    && csvVol    !== candVol)     conflicts.push('volume');
  if (csvWeight && candWeight && csvWeight !== candWeight)  conflicts.push('weight');
  if (csvPack   && candPack   && csvPack   !== candPack)   conflicts.push('pack');

  if (conflicts.length > 0) {
    return { result_status: 'rejected', validation_score: 0, validation_reason: 'Metadata conflicts detected.', conflicting_fields: conflicts.join(',') };
  }

  if (csvBrand  && candBrand  && csvBrand  === candBrand)  matched.push('brand');
  if (csvVol    && candVol    && csvVol    === candVol)     matched.push('volume');
  if (csvWeight && candWeight && csvWeight === candWeight)  matched.push('weight');
  if (csvPack   && candPack   && csvPack   === candPack)   matched.push('pack');

  const brandMatched       = matched.includes('brand');
  const volOrWeightMatched = matched.includes('volume') || matched.includes('weight');
  const packMatched        = matched.includes('pack');

  let score = 50;
  if (brandMatched && volOrWeightMatched && packMatched) {
    score = 90;
  } else if (brandMatched && (volOrWeightMatched || packMatched)) {
    score = 80;
  } else if (brandMatched) {
    score = 70;
  } else if (P.normalizeText(csvName) === P.normalizeText(candName)) {
    score = 85;
  } else if (P.titlesMatchAfterSuffixStrip(csvName, candName)) {
    // FIX 2 follow-up: near-exact title match after stripping trailing pack-count suffix
    score = 90;
  } else if (volOrWeightMatched || packMatched) {
    score = 60;
  }

  // FIX 2: Revised barcode strategy boost
  if (strategy === 'barcode' || strategy === 'normalized_barcode') {
    const candidateIsVerifiableEAN = candidateBarcode !== null &&
                                     candidateBarcode !== undefined &&
                                     candidateBarcode.length >= 8;
    if (candidateIsVerifiableEAN && csvBarcode === candidateBarcode) {
      score = 100;
    } else if (brandMatched && conflicts.length === 0 && candidateIsVerifiableEAN) {
      score = 90;
    } else if (!candidateIsVerifiableEAN) {
      if (csvBrand && !candBrand) {
        return {
          result_status: 'rejected',
          validation_score: 0,
          validation_reason: `Barcode search returned unverifiable candidate (barcode "${candidateBarcode}", ${candidateBarcode ? candidateBarcode.length : 0} digits). Source brand "${csvBrand}" has no match in candidate title — likely an unrelated fallback or promoted product.`,
          conflicting_fields: 'brand',
          _debug: { csvBrand, candBrand, csvVol, candVol, csvWeight, candWeight, csvPack, candPack },
        };
      }
    } else if (score >= 90) {
      score = Math.min(99, score + 5);
    } else {
      score = Math.min(89, score + 15);
    }
    matched.push('supplier_barcode_search');
  }

  let status = 'rejected';
  if (score >= 90) status = 'success';
  else if (score >= 60) status = 'ambiguous';

  return {
    result_status: status,
    validation_score: score,
    validation_reason: `Evaluated with score ${score}.`,
    matched_fields: matched.join(','),
    _debug: { csvBrand, candBrand, csvVol, candVol, csvWeight, candWeight, csvPack, candPack },
  };
}

// ── Candidate: the Parfetts Baby Wipes product ───────────────────────────────
const BABY_WIPES_CANDIDATE = {
  rawTitle:    'Go Local Sensitive Baby Wipes Pm 89p 54s',
  rawBarcode:  '123190',
  rawPackInfo: '1 x 12',
  price:       5.69,
  inStock:     true,
  promotionFlag: false,
};

// ── Test cases ───────────────────────────────────────────────────────────────
const TEST_CASES = [
  // ── 1. Core goal: legitimate Baby Wipes via exact_name MUST succeed ────────
  {
    label: 'Legitimate Baby Wipes — exact_name strategy',
    csvProduct: { barcode: '5000112693577', product_name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'exact_name',
    expectStatus: 'success',
    expectScoreMin: 90,
    expectNote: 'titlesMatchAfterSuffixStrip strips "54s" → exact base-title match → score=90',
  },
  // ── 2. Legitimate Baby Wipes via cleaned_name MUST succeed ─────────────────
  {
    label: 'Legitimate Baby Wipes — cleaned_name strategy',
    csvProduct: { barcode: '5000112693577', product_name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'cleaned_name',
    expectStatus: 'success',
    expectScoreMin: 90,
    expectNote: 'cleaned_name — no barcode boost, suffix strip fires → score=90',
  },
  // ── 3. Legitimate Baby Wipes via barcode (no brand conflict) ───────────────
  {
    label: 'Legitimate Baby Wipes — barcode strategy (csvBrand=null, FIX 2B must not trigger)',
    csvProduct: { barcode: '5000112693577', product_name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectStatus: 'success',
    expectScoreMin: 90,
    expectNote: 'csvBrand=null so FIX 2B does not fire; suffix strip → score=90; no boost since candidate barcode unverifiable',
  },
  // ── 4–7. False positives must remain REJECTED ─────────────────────────────
  {
    label: 'Monster Energy → Baby Wipes (false-positive, must be REJECTED)',
    csvProduct: { barcode: '5000177500971', product_name: 'MONSTER ENERGY ORIGINAL 500ML' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectStatus: 'rejected',
    expectScoreMin: null,
    expectNote: 'FIX 2B: csvBrand="monster", candBrand=null → rejected',
  },
  {
    label: 'Red Bull → Baby Wipes (false-positive, must be REJECTED)',
    csvProduct: { barcode: '90493577', product_name: 'RED BULL ENERGY PM280' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectStatus: 'rejected',
    expectNote: 'FIX 2B: csvBrand="red bull", candBrand=null → rejected',
  },
  {
    label: 'Delamere Banana Milk → Baby Wipes (false-positive, must be REJECTED)',
    csvProduct: { barcode: '5016860000178', product_name: 'DELAMERE BANANA MILK' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectStatus: 'rejected',
    expectNote: 'FIX 2B: csvBrand="delamere", candBrand=null → rejected',
  },
  {
    label: 'Volvic Cherry → Baby Wipes (false-positive, must be REJECTED)',
    csvProduct: { barcode: '3057640600128', product_name: 'VOLVIC CHERRY' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectStatus: 'rejected',
    expectNote: 'FIX 2B: csvBrand="volvic", candBrand=null → rejected',
  },
  // ── 8. Different variant must NOT be forced to SUCCESS ─────────────────────
  {
    label: 'Different variant: UNSCENTED vs SENSITIVE (must NOT be SUCCESS)',
    csvProduct: { barcode: '5000999000001', product_name: 'GO LOCAL BABY WIPES UNSCENTED PM 89P' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'exact_name',
    expectStatus: '!success',
    expectNote: '"UNSCENTED" vs "SENSITIVE" — titles differ after strip → score=50, rejected',
  },
  // ── 9. Incompatible pack count (24s vs 54s) must NOT match ─────────────────
  {
    label: 'Same base title but CONFLICTING pack count: source "24s" vs candidate "54s"',
    csvProduct: { barcode: '5000112693001', product_name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P 24s' },
    candidate:  BABY_WIPES_CANDIDATE, // candidate has "54s"
    strategy:   'exact_name',
    expectStatus: '!success',
    expectNote: 'Safety rule 1: both sides have suffix, values differ (24 ≠ 54) → titlesMatchAfterSuffixStrip=false → score=50',
  },
];

// ── Run tests ─────────────────────────────────────────────────────────────────
console.log('=== FIX 2 FOLLOW-UP — Near-exact Title Match Regression Tests ===\n');
console.log('Trace — why "54s" causes score=50 BEFORE this fix:');
console.log('  CSV  normalized: golocalsensitivebabywipespm89p');
console.log('  CAND normalized: golocalsensitivebabywipespm89p54s');
console.log('  Exact match? false → score stays 50 → status=rejected\n');
console.log('Trace — how stripPackCountSuffix fixes it:');
console.log('  CSV  stripped: golocalsensitivebabywipespm89p  (no change)');
console.log('  CAND stripped: golocalsensitivebabywipespm89p  (\'54s\' removed)');
console.log('  Near-exact match? true → score=90 → status=success\n');

const rows = [];
let allPass = true;

for (const tc of TEST_CASES) {
  const result = evaluateCandidate(tc.csvProduct, tc.candidate, tc.strategy);
  const debug = result._debug || {};
  delete result._debug;

  let pass;
  if (tc.expectStatus === '!success') {
    pass = result.result_status !== 'success';
  } else {
    pass = result.result_status === tc.expectStatus;
    if (tc.expectScoreMin !== null && tc.expectScoreMin !== undefined) {
      pass = pass && result.validation_score >= tc.expectScoreMin;
    }
  }

  if (!pass) allPass = false;

  rows.push({
    label:         tc.label,
    status:        result.result_status,
    score:         result.validation_score,
    reason:        result.validation_reason,
    csvBrand:      debug.csvBrand,
    candBrand:     debug.candBrand,
    pass:          pass ? '✅ PASS' : '❌ FAIL',
    expectNote:    tc.expectNote,
  });

  console.log(`Test: ${tc.label}`);
  console.log(`  Strategy:        ${tc.strategy}`);
  console.log(`  CSV brand:       ${debug.csvBrand ?? 'null'}`);
  console.log(`  Cand brand:      ${debug.candBrand ?? 'null'}`);
  console.log(`  suffix in CSV:   ${P.stripPackCountSuffix(tc.csvProduct.product_name) !== tc.csvProduct.product_name ? 'YES — stripped' : 'no'}`);
  console.log(`  suffix in CAND:  ${P.stripPackCountSuffix(tc.candidate.rawTitle) !== tc.candidate.rawTitle ? 'YES — stripped' : 'no'}`);
  console.log(`  titlesMatch:     ${P.titlesMatchAfterSuffixStrip(tc.csvProduct.product_name, tc.candidate.rawTitle)}`);
  console.log(`  Result:          ${result.result_status.toUpperCase()} (score: ${result.validation_score})`);
  console.log(`  Reason:          ${result.validation_reason}`);
  console.log(`  Expected:        ${tc.expectStatus}${tc.expectScoreMin ? ' score≥'+tc.expectScoreMin : ''}`);
  console.log(`  Note:            ${tc.expectNote}`);
  console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}\n`);
}

// ── Summary table ─────────────────────────────────────────────────────────────
console.log('=== SUMMARY TABLE ===\n');
console.log('| # | Test | CSV Brand | RESULT | Score | PASS |');
console.log('| :- | :--- | :--- | :--- | :-: | :-: |');
rows.forEach((r, i) => {
  console.log(`| ${i+1} | ${r.label} | ${r.csvBrand ?? 'null'} | ${r.status} | ${r.score} | ${r.pass} |`);
});

console.log(`\nOverall: ${allPass ? '✅ ALL ' + rows.length + ' TESTS PASS' : '❌ SOME TESTS FAILED'}`);

// ── Additional: directly verify new methods ───────────────────────────────────
console.log('\n=== DIRECT METHOD VERIFICATION ===');
const cases = [
  ['GO LOCAL SENSITIVE BABY WIPES PM 89P', 'Go Local Sensitive Baby Wipes Pm 89p 54s', true,  'Standard case'],
  ['GO LOCAL SENSITIVE BABY WIPES PM 89P 24s', 'Go Local Sensitive Baby Wipes Pm 89p 54s', false, 'Conflicting suffix (24≠54)'],
  ['GO LOCAL BABY WIPES UNSCENTED PM 89P', 'Go Local Sensitive Baby Wipes Pm 89p 54s', false, 'Different variant'],
  ['MONSTER ENERGY ORIGINAL 500ML', 'Go Local Sensitive Baby Wipes Pm 89p 54s', false, 'Completely different product'],
  ['COCA COLA ORIGINAL TASTE 330ML', 'Coca Cola Original Taste Pm £1.15 330ml Can', false,  'Same product, extra title text'],
  ['GO LOCAL SENSITIVE BABY WIPES PM 89P 54s', 'Go Local Sensitive Baby Wipes Pm 89p 54s', true, 'Both have same suffix "54s"'],
];
for (const [csv, cand, expected, note] of cases) {
  const result = P.titlesMatchAfterSuffixStrip(csv, cand);
  const pass = result === expected;
  console.log(`  ${pass ? '✅' : '❌'} titlesMatchAfterSuffixStrip: ${result} (expected ${expected}) — ${note}`);
}
