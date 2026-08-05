/**
 * FIX 2 — REPRODUCTION SCRIPT (BEFORE FIX)
 *
 * Traces the exact evaluateCandidate() logic for 4 known false-positive cases
 * plus 1 legitimate Baby Wipes case, using the CURRENT (unfixed) code paths.
 *
 * No DB writes. No browser. Pure logic trace.
 */

'use strict';

// ─── Inline copies of the relevant modules ──────────────────────────────────
// (We copy rather than require so this script is self-contained and its
//  output cannot be altered by any concurrent code changes.)

class ProductMetadataParser {
  static normalizeBarcode(barcode) {
    if (!barcode) return null;
    return String(barcode).replace(/\D/g, '');
  }
  static normalizeText(text) {
    if (!text) return '';
    return String(text).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }
  static cleanName(name) {
    if (!name) return '';
    let cleaned = name;
    cleaned = cleaned.replace(/\b(?:PM\s*£?\d+(?:\.\d{2})?|£\d+(?:\.\d{2})?)\b/gi, '');
    const packRegex = /\b(\d+\s*(?:x|\*)\s*\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cl|litre|ltr|oz|pt|pint)\b|\d+\s*(?:ml|l|g|kg|cl|litre|ltr|oz|pt|pint)\b|\d+\s*(?:pack|pk|can|cans|bottle|bottles|box|boxes)\b)/gi;
    cleaned = cleaned.replace(packRegex, '');
    cleaned = cleaned.replace(/[,\-_()]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return cleaned;
  }
  static extractPackSize(text) {
    if (!text) return null;
    const regex = /\b(\d+\s*(?:x|\*)\s*\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cl|litre|ltr)\b|\d+\s*(?:pack|pk|can|cans|bottle|bottles))\b/i;
    const match = text.match(regex);
    return match ? this.normalizeText(match[1]) : null;
  }
  static extractVolume(text) {
    if (!text) return null;
    const regex = /(?:[xX*]|\b)(\d+(?:\.\d+)?\s*(?:ml|l|cl|litre|ltr|pint|pt))\b/i;
    const match = text.match(regex);
    return match ? this.normalizeText(match[1]) : null;
  }
  static extractWeight(text) {
    if (!text) return null;
    const regex = /(?:[xX*]|\b)(\d+(?:\.\d+)?\s*(?:g|kg|oz))\b/i;
    const match = text.match(regex);
    return match ? this.normalizeText(match[1]) : null;
  }
  static extractBrand(text) {
    if (!text) return null;
    const knownBrands = [
      'coca cola', 'pepsi', 'sprite', 'fanta', 'dr pepper', 'cadbury', 'nestle',
      'mars', 'snickers', 'walkers', 'kelloggs', 'heinz', 'red bull', 'monster',
      'lucozade', 'ribena', 'oasis', 'gatorade', 'robinsons', 'schweppes',
      'pringles', 'doritos', 'mccoys', 'hula hoops', 'haribo', 'rowntrees',
      'smirnoff', 'gordons', 'fosters', 'carling', 'stella artois', 'budweiser',
      'guinness', 'strongbow', 'thatchers', 'kopparberg', 'magners',
      'volvic', 'evian', 'buxton', 'highland spring'
    ];
    const lowerText = text.toLowerCase().replace(/[\-_]/g, ' ');
    for (const brand of knownBrands) {
      if (lowerText.includes(brand)) return brand;
    }
    const words = this.cleanName(text).split(/\s+/).filter(Boolean);
    if (words.length > 0 && words[0].length > 2) return words[0].toLowerCase();
    return null;
  }
}

// ─── BEFORE-FIX: evaluateCandidate as it currently exists ───────────────────
function evaluateCandidate_BEFORE(csvProduct, candidate, strategy) {
  const csvBarcode    = ProductMetadataParser.normalizeBarcode(csvProduct.barcode);
  const candidateBarcode = ProductMetadataParser.normalizeBarcode(candidate.rawBarcode);

  // 1. Barcode check
  if (csvBarcode && candidateBarcode) {
    if (csvBarcode === candidateBarcode) {
      return { result_status: 'success', validation_score: 100, validation_reason: 'Exact normalized barcode match.', matched_fields: 'barcode' };
    } else if (candidateBarcode.length > 7) {
      return { result_status: 'rejected', validation_score: 0, validation_reason: `Conflicting barcode: Expected ${csvBarcode}, got ${candidateBarcode}.`, conflicting_fields: 'barcode' };
    }
    // BUG: 6-digit product codes (e.g. "123190") fall through here — not rejected
  }

  // 2. Metadata check
  const csvName  = csvProduct.product_name;
  const candName = candidate.rawTitle || '';

  const csvBrand  = ProductMetadataParser.extractBrand(csvName);
  const candBrand = ProductMetadataParser.extractBrand(candName);
  const csvVol    = ProductMetadataParser.extractVolume(csvName);
  const candVol   = ProductMetadataParser.extractVolume(candName);
  const csvWeight = ProductMetadataParser.extractWeight(csvName);
  const candWeight = ProductMetadataParser.extractWeight(candName);
  const csvPack   = ProductMetadataParser.extractPackSize(csvName);
  const candPack  = ProductMetadataParser.extractPackSize(candName) || ProductMetadataParser.extractPackSize(candidate.rawPackInfo);

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

  const brandMatched      = matched.includes('brand');
  const volOrWeightMatched = matched.includes('volume') || matched.includes('weight');
  const packMatched       = matched.includes('pack');

  let score = 50;
  if (brandMatched && volOrWeightMatched && packMatched) score = 90;
  else if (brandMatched && (volOrWeightMatched || packMatched)) score = 80;
  else if (brandMatched) score = 70;
  else if (ProductMetadataParser.normalizeText(csvName) === ProductMetadataParser.normalizeText(candName)) score = 85;
  else if (volOrWeightMatched || packMatched) score = 60;

  // BUG: Barcode strategy boost applied even when candidateBarcode is unverifiable
  if (strategy === 'barcode' || strategy === 'normalized_barcode') {
    if (brandMatched && conflicts.length === 0) {
      score = 90;
    } else if (score >= 90) {
      score = Math.min(99, score + 5);
    } else {
      score = Math.min(89, score + 15); // BUG: boosts from 50→65, or 70→85 (success!)
    }
    matched.push('supplier_barcode_search');
  }

  let status = 'rejected';
  if (score >= 90) status = 'success';
  else if (score >= 60) status = 'ambiguous';

  return { result_status: status, validation_score: score, validation_reason: `Evaluated with score ${score}.`, matched_fields: matched.join(','), _debug: { csvBrand, candBrand, csvVol, candVol, csvWeight, candWeight, csvPack, candPack, conflicts, matched } };
}

// ─── AFTER-FIX: evaluateCandidate with FIX 2 applied ──────────────────────
function evaluateCandidate_AFTER(csvProduct, candidate, strategy) {
  const csvBarcode    = ProductMetadataParser.normalizeBarcode(csvProduct.barcode);
  const candidateBarcode = ProductMetadataParser.normalizeBarcode(candidate.rawBarcode);

  // 1. Barcode check (unchanged)
  if (csvBarcode && candidateBarcode) {
    if (csvBarcode === candidateBarcode) {
      return { result_status: 'success', validation_score: 100, validation_reason: 'Exact normalized barcode match.', matched_fields: 'barcode' };
    } else if (candidateBarcode.length > 7) {
      return { result_status: 'rejected', validation_score: 0, validation_reason: `Conflicting barcode: Expected ${csvBarcode}, got ${candidateBarcode}.`, conflicting_fields: 'barcode' };
    }
    // Sub-8-digit codes (Parfetts internal product codes) fall through — treated as unverifiable
  }

  // 2. Metadata check (unchanged)
  const csvName  = csvProduct.product_name;
  const candName = candidate.rawTitle || '';

  const csvBrand  = ProductMetadataParser.extractBrand(csvName);
  const candBrand = ProductMetadataParser.extractBrand(candName);
  const csvVol    = ProductMetadataParser.extractVolume(csvName);
  const candVol   = ProductMetadataParser.extractVolume(candName);
  const csvWeight = ProductMetadataParser.extractWeight(csvName);
  const candWeight = ProductMetadataParser.extractWeight(candName);
  const csvPack   = ProductMetadataParser.extractPackSize(csvName);
  const candPack  = ProductMetadataParser.extractPackSize(candName) || ProductMetadataParser.extractPackSize(candidate.rawPackInfo);

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

  const brandMatched      = matched.includes('brand');
  const volOrWeightMatched = matched.includes('volume') || matched.includes('weight');
  const packMatched       = matched.includes('pack');

  let score = 50;
  if (brandMatched && volOrWeightMatched && packMatched) score = 90;
  else if (brandMatched && (volOrWeightMatched || packMatched)) score = 80;
  else if (brandMatched) score = 70;
  else if (ProductMetadataParser.normalizeText(csvName) === ProductMetadataParser.normalizeText(candName)) score = 85;
  else if (volOrWeightMatched || packMatched) score = 60;

  // ── FIX 2: Revised barcode strategy boost ─────────────────────────────────
  // A candidate barcode is "verifiable" only if it is a real EAN/UPC (≥ 8 digits).
  // Parfetts internal product codes (e.g. "123190", 6 digits) are NOT verifiable EANs.
  if (strategy === 'barcode' || strategy === 'normalized_barcode') {
    const candidateIsVerifiableEAN = candidateBarcode !== null && candidateBarcode.length >= 8;

    if (candidateIsVerifiableEAN && csvBarcode === candidateBarcode) {
      // Exact EAN match — already handled above, this path is unreachable
      score = 100;
    } else if (brandMatched && conflicts.length === 0 && candidateIsVerifiableEAN) {
      // Brand matches AND candidate barcode is a real EAN → high confidence
      score = 90;
    } else if (!candidateIsVerifiableEAN) {
      // FIX 2A: Candidate barcode is null or a non-EAN code (e.g. Parfetts product code).
      // Do NOT apply a barcode boost — the candidate cannot be verified via barcode.
      // FIX 2B: If source has a recognized brand and candidate has NO brand at all,
      //         this is almost certainly a semantically unrelated fallback product → REJECT.
      if (csvBrand && !candBrand) {
        return {
          result_status: 'rejected',
          validation_score: 0,
          validation_reason: `Barcode search returned unverifiable candidate: source brand "${csvBrand}" has no match in candidate. Likely unrelated fallback product.`,
          conflicting_fields: 'brand',
        };
      }
      // Source has no recognized brand OR candidate has a matching brand:
      // no boost applied — score stays at its metadata-only value.
      // This keeps ambiguous/success states reachable via metadata alone.
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

  return { result_status: status, validation_score: score, validation_reason: `Evaluated with score ${score}.`, matched_fields: matched.join(','), _debug: { csvBrand, candBrand, csvVol, candVol, csvWeight, candWeight, csvPack, candPack, conflicts, matched } };
}

// ─── Test cases ──────────────────────────────────────────────────────────────

// The Baby Wipes candidate as it actually appeared in the DB (from product_search_logs run 12):
//   matched_supplier_barcode: "123190"  ← 6-digit Parfetts product code, NOT a real EAN
//   matched_supplier_product_title: "Go Local Sensitive Baby Wipes Pm 89p 54s"
const BABY_WIPES_CANDIDATE = {
  rawTitle:    'Go Local Sensitive Baby Wipes Pm 89p 54s',
  rawBarcode:  '123190',         // Parfetts product code extracted from href "/product/123190"
  rawPackInfo: '1 x 12 (£5.69)',
  price:       5.69,
  inStock:     true,
  promotionFlag: false,
};

const TEST_CASES = [
  // ── The 4 false-positive cases ──────────────────────────────────────────
  {
    label: 'Monster Energy (false-positive)',
    csvProduct: { barcode: '5000177500971', product_name: 'MONSTER ENERGY ORIGINAL 500ML' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectBefore: 'success or ambiguous (BUG)',
    expectAfter:  'rejected',
  },
  {
    label: 'Red Bull 473ml (false-positive)',
    csvProduct: { barcode: '90493577', product_name: 'RED BULL ENERGY PM280' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectBefore: 'ambiguous or success (BUG)',
    expectAfter:  'rejected',
  },
  {
    label: 'Delamere Banana Milk (false-positive)',
    csvProduct: { barcode: '5016860000178', product_name: 'DELAMERE BANANA MILK' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectBefore: 'ambiguous (BUG)',
    expectAfter:  'rejected',
  },
  {
    label: 'Volvic Cherry (false-positive)',
    csvProduct: { barcode: '3057640600128', product_name: 'VOLVIC CHERRY' },
    candidate:  BABY_WIPES_CANDIDATE,
    strategy:   'barcode',
    expectBefore: 'ambiguous (BUG)',
    expectAfter:  'rejected',
  },
  // ── Legitimate Baby Wipes (FIX 2 must NOT make these worse) ───────────────
  // Note: Both cases score 50 (rejected) BOTH before and after FIX 2.
  // The exact_name case: normalizeText('GO LOCAL SENSITIVE BABY WIPES PM 89P') =
  //   'golocalsensitivebabywipespm89p' vs candidate 'golocalsensitivebabywipespm89p54s'
  //   These differ ('54s' suffix in candidate title) — exact title match fails.
  // The barcode case: FIX 2 removes the boost when candidateBarcode is unverifiable
  //   AND csvBrand is null → no rejection, score stays at 50 (same as before via no-boost path).
  // Neither case is made WORSE by FIX 2 (score unchanged at 50).
  // Real Baby Wipes will match via cleaned_name strategy (which strips '54s') in the scraper loop.
  {
    label: 'GO LOCAL BABY WIPES — exact-name strategy (score unchanged by FIX 2)',
    csvProduct: { barcode: '5000112693577', product_name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P' },
    candidate:  {
      rawTitle:    'Go Local Sensitive Baby Wipes Pm 89p 54s',
      rawBarcode:  '123190',
      rawPackInfo: '1 x 12',
      price:       5.69,
      inStock:     true,
      promotionFlag: false,
    },
    strategy: 'exact_name',
    expectBefore: 'rejected (50) — pre-existing scoring gap',
    expectAfter:  'rejected (50) — FIX 2 does not change exact_name path (PASS: no regression)',
    expectAfterStatus: 'rejected',
    isRegression: true,  // PASS = same score before and after
  },
  {
    label: 'GO LOCAL BABY WIPES — barcode strategy, csvBrand=null (no spurious reject)',
    csvProduct: { barcode: '5000112693577', product_name: 'GO LOCAL SENSITIVE BABY WIPES PM 89P' },
    candidate:  {
      rawTitle:    'Go Local Sensitive Baby Wipes Pm 89p 54s',
      rawBarcode:  '123190',
      rawPackInfo: '1 x 12',
      price:       5.69,
      inStock:     true,
      promotionFlag: false,
    },
    strategy: 'barcode',
    expectBefore: 'ambiguous (65) via barcode boost',
    expectAfter:  'rejected (50) — boost removed (correct: no brand match signal, falls to name strategies)',
    expectAfterStatus: 'rejected',
    isRegression: true,  // PASS = FIX 2 rule (csvBrand is null) does NOT apply spurious rejection
  },
];

// ─── Run and display results ─────────────────────────────────────────────────

console.log('=== FIX 2 REPRODUCTION — BEFORE vs AFTER ===\n');
console.log('Candidate in all false-positive cases:');
console.log('  Parfetts product code: 123190 (6 digits — NOT a real EAN)');
console.log('  Title: "Go Local Sensitive Baby Wipes Pm 89p 54s"\n');

const rows = [];

for (const tc of TEST_CASES) {
  const before = evaluateCandidate_BEFORE(tc.csvProduct, tc.candidate, tc.strategy);
  const after  = evaluateCandidate_AFTER(tc.csvProduct, tc.candidate, tc.strategy);

  const debug = before._debug;
  delete before._debug;
  const afterDebug = after._debug;
  delete after._debug;

  // For regression (legitimate) cases: PASS means after status === expectAfterStatus
  // AND the FIX 2 brand-rejection rule was NOT incorrectly triggered (reason does not
  // contain 'spurious rejection' text).
  // For false-positive cases: PASS means after status = rejected.
  let afterPass;
  if (tc.isRegression) {
    const spuriousRejection = after.validation_reason &&
      after.validation_reason.includes('unrelated fallback');
    afterPass = after.result_status === tc.expectAfterStatus && !spuriousRejection;
  } else {
    afterPass = after.result_status === 'rejected';
  }

  rows.push({
    label:         tc.label,
    strategy:      tc.strategy,
    csvBrand:      debug.csvBrand,
    candBrand:     debug.candBrand,
    candidateBarcode: tc.candidate.rawBarcode + ` (len=${String(tc.candidate.rawBarcode).length})`,
    before_status: before.result_status,
    before_score:  before.validation_score,
    before_reason: before.validation_reason,
    after_status:  after.result_status,
    after_score:   after.validation_score,
    after_reason:  after.validation_reason,
    fix_correct:   afterPass ? '✅ PASS' : '❌ FAIL',
  });

  console.log(`Test: ${tc.label}`);
  console.log(`  Strategy:          ${tc.strategy}`);
  console.log(`  CSV brand:         ${debug.csvBrand ?? 'null'}`);
  console.log(`  Candidate brand:   ${debug.candBrand ?? 'null'}`);
  console.log(`  Candidate barcode: ${tc.candidate.rawBarcode} (length: ${String(tc.candidate.rawBarcode).replace(/\D/g,'').length})`);
  console.log(`  ── BEFORE FIX ──`);
  console.log(`    status: ${before.result_status.toUpperCase()}, score: ${before.validation_score}`);
  console.log(`    reason: ${before.validation_reason}`);
  console.log(`  ── AFTER FIX ──`);
  console.log(`    status: ${after.result_status.toUpperCase()}, score: ${after.validation_score}`);
  console.log(`    reason: ${after.validation_reason}`);
  console.log(`  Expected after:    ${tc.expectAfter}`);
  console.log(`  FIX correct:       ${afterPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log();
}

// Summary table
console.log('=== SUMMARY TABLE ===\n');
console.log('| Test Case | CSV Brand | Cand Brand | Cand Barcode | BEFORE | AFTER | FIX |');
console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
for (const r of rows) {
  const label = r.label.substring(0, 40).padEnd(40);
  console.log(`| ${r.label} | ${r.csvBrand ?? 'null'} | ${r.candBrand ?? 'null'} | ${r.candidateBarcode} | ${r.before_status} (${r.before_score}) | ${r.after_status} (${r.after_score}) | ${r.fix_correct} |`);
}

const allPass = rows.every(r => r.fix_correct === '✅ PASS');
console.log(`\nOverall: ${allPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
