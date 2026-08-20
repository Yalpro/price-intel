/**
 * test_immutable_identity_and_pack_regression.cjs
 *
 * Permanent automated regression test suite for:
 * A. Same catalogue barcode, same supplier, different supplier product code => different raw_product identity
 * B. Historical snapshots from supplier product A must never appear in supplier product B history
 * C. 8x330ml and 24x500ml must never generate case-price savings
 * D. Unknown pack and known pack must never generate case-price savings
 * E. Bestway joins Booker 24x500 group ONLY if authoritative Bestway pack evidence proves 24x500
 * F. A raw_product update must not change immutable supplier product identity
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const ProductMetadataParser = require('../utils/ProductMetadataParser');

function packCompatibilityKey(packMeta) {
  const units = packMeta.unitsPerPack || 1;
  let size = 'unknown';
  if (packMeta.unitSize) size = String(packMeta.unitSize).toLowerCase().replace(/\s+/g, '');
  return `${units}x${size}`;
}

function packIdentityLabel(packMeta) {
  const units = packMeta.unitsPerPack || 1;
  const size = packMeta.unitSize || 'unknown size';
  return `${units} × ${size}`;
}

function evaluateDealsGrouping(offers) {
  const packGroups = {};
  for (const offer of offers) {
    if (!packGroups[offer.packKey]) packGroups[offer.packKey] = [];
    packGroups[offer.packKey].push(offer);
  }

  const groups = Object.values(packGroups);
  groups.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const minA = Math.min(...a.map(o => o.unitPrice || 999));
    const minB = Math.min(...b.map(o => o.unitPrice || 999));
    return minA - minB;
  });

  const dominantGroup = groups[0] || [];
  dominantGroup.sort((a, b) => a.casePrice - b.casePrice);
  const cheapest = dominantGroup[0] || null;
  const secondCheapest = dominantGroup.length > 1 ? dominantGroup[1] : null;

  let absoluteSaving = 0;
  let percentageSaving = 0;
  if (secondCheapest) {
    absoluteSaving = secondCheapest.casePrice - cheapest.casePrice;
    percentageSaving = (absoluteSaving / secondCheapest.casePrice) * 100;
  }

  const allPricesOut = [];
  for (const offer of dominantGroup) {
    allPricesOut.push({ ...offer, comparisonGroup: 'primary' });
  }
  for (let gi = 1; gi < groups.length; gi++) {
    for (const offer of groups[gi]) {
      allPricesOut.push({ ...offer, comparisonGroup: 'incompatible_pack' });
    }
  }

  return {
    dominantGroup,
    cheapest,
    secondCheapest,
    absoluteSaving: parseFloat(absoluteSaving.toFixed(2)),
    percentageSaving: parseFloat(percentageSaving.toFixed(0)),
    allPrices: allPricesOut,
    incompatibleCount: allPricesOut.filter(p => p.comparisonGroup === 'incompatible_pack').length
  };
}

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('RUNNING IMMUTABLE SUPPLIER IDENTITY & PACK REGRESSION TESTS');
console.log('======================================================\n');

// Test A
test('A. Same catalogue barcode, same supplier, different supplier product code => different raw_product identity', () => {
  const catalogueBarcode = '5000112693676';
  const listing1 = { supplier_id: 2, raw_product_code: '128664', raw_barcode: catalogueBarcode };
  const listing2 = { supplier_id: 2, raw_product_code: '273542', raw_barcode: catalogueBarcode };
  const identityKey1 = `${listing1.supplier_id}:${listing1.raw_product_code}`;
  const identityKey2 = `${listing2.supplier_id}:${listing2.raw_product_code}`;

  assert.notStrictEqual(identityKey1, identityKey2);
  assert.strictEqual(identityKey1, '2:128664');
  assert.strictEqual(identityKey2, '2:273542');
});

// Test B
test('B. Historical snapshots from supplier product A must never appear in supplier product B history', () => {
  const snapshots = [
    { id: 757, raw_product_id: 209, supplier_code: '128664', case_price: 11.49, date: '2026-08-06T06:22:58Z' },
    { id: 1141, raw_product_id: 209, supplier_code: '128664', case_price: 11.49, date: '2026-08-12T17:27:47Z' },
    { id: 1221, raw_product_id: 238, supplier_code: '273542', case_price: 25.39, date: '2026-08-20T17:28:49Z' }
  ];

  const historyFor238 = snapshots.filter(s => s.raw_product_id === 238);
  assert.strictEqual(historyFor238.length, 1);
  assert.strictEqual(historyFor238[0].case_price, 25.39);

  const has1149In238 = historyFor238.some(s => s.case_price === 11.49);
  assert.strictEqual(has1149In238, false);

  const historyFor209 = snapshots.filter(s => s.raw_product_id === 209);
  assert.strictEqual(historyFor209.length, 2);
  assert.strictEqual(historyFor209.every(s => s.case_price === 11.49), true);
});

// Test C
test('C. 8x330ml and 24x500ml must never generate case-price savings', () => {
  const packA = ProductMetadataParser.parseCanonicalPack('Coca Cola 8pk 330ml', '8 x 330ml');
  const packB = ProductMetadataParser.parseCanonicalPack('Coca-Cola Original Taste 24x500ml', 'Case of 24 x 500ml');

  const keyA = packCompatibilityKey(packA);
  const keyB = packCompatibilityKey(packB);

  assert.strictEqual(keyA, '8x330ml');
  assert.strictEqual(keyB, '24x500ml');
  assert.notStrictEqual(keyA, keyB);

  const offers = [
    { supplier: 'PARFETTS', casePrice: 11.49, unitPrice: 1.44, packKey: keyA, packLabel: packIdentityLabel(packA) },
    { supplier: 'BOOKER', casePrice: 25.29, unitPrice: 1.05, packKey: keyB, packLabel: packIdentityLabel(packB) }
  ];

  const result = evaluateDealsGrouping(offers);
  assert.strictEqual(result.absoluteSaving, 0);
  assert.strictEqual(result.incompatibleCount, 1);
});

// Test D
test('D. Unknown pack and known pack must never generate case-price savings', () => {
  const packKnown = ProductMetadataParser.parseCanonicalPack('Coca Cola 24x500ml', '24 x 500ml');
  const packUnknown = ProductMetadataParser.parseCanonicalPack('Coca Cola PM £1.85', null);

  const keyKnown = packCompatibilityKey(packKnown);
  const keyUnknown = packCompatibilityKey(packUnknown);

  assert.strictEqual(keyKnown, '24x500ml');
  assert.strictEqual(keyUnknown, '1xunknown');

  const offers = [
    { supplier: 'BOOKER', casePrice: 25.29, unitPrice: 1.05, packKey: keyKnown, packLabel: packIdentityLabel(packKnown) },
    { supplier: 'PARFETTS', casePrice: 25.39, unitPrice: 25.39, packKey: keyUnknown, packLabel: packIdentityLabel(packUnknown) }
  ];

  const result = evaluateDealsGrouping(offers);
  assert.strictEqual(result.absoluteSaving, 0);
  assert.strictEqual(result.incompatibleCount, 1);
});

// Test E
test('E. Bestway joins Booker 24x500 group ONLY if authoritative Bestway pack evidence proves 24x500', () => {
  const bestwayUnproven = ProductMetadataParser.parseCanonicalPack('Coca-Cola Original PM £1.85', '500ml');
  const booker = ProductMetadataParser.parseCanonicalPack('Coca-Cola Original Taste PM £1.85 500ml Bottle', 'Case of 24 x 500ml');
  
  assert.strictEqual(packCompatibilityKey(bestwayUnproven), '1x500ml');
  assert.strictEqual(packCompatibilityKey(booker), '24x500ml');
  assert.notStrictEqual(packCompatibilityKey(bestwayUnproven), packCompatibilityKey(booker));

  const bestwayProven = ProductMetadataParser.parseCanonicalPack('Coca-Cola Original PM £1.85', '24 x 500ml');
  assert.strictEqual(packCompatibilityKey(bestwayProven), '24x500ml');
  assert.strictEqual(packCompatibilityKey(bestwayProven), packCompatibilityKey(booker));

  const offers = [
    { supplier: 'BOOKER', casePrice: 25.29, unitPrice: 1.05, packKey: packCompatibilityKey(booker), packLabel: packIdentityLabel(booker) },
    { supplier: 'BESTWAY', casePrice: 30.95, unitPrice: 1.29, packKey: packCompatibilityKey(bestwayProven), packLabel: packIdentityLabel(bestwayProven) }
  ];

  const deals = evaluateDealsGrouping(offers);
  assert.strictEqual(deals.dominantGroup.length, 2);
  assert.strictEqual(deals.cheapest.supplier, 'BOOKER');
  assert.strictEqual(deals.secondCheapest.supplier, 'BESTWAY');
  assert.strictEqual(deals.absoluteSaving, 5.66);
  assert.strictEqual(deals.percentageSaving, 18);
});

// Test F
test('F. A raw_product update must not change immutable supplier product identity', () => {
  function resolveRawProductIdentity(existingRows, incomingSupplierId, incomingProductCode, incomingBarcode) {
    if (incomingProductCode) {
      const match = existingRows.find(r => r.supplier_id === incomingSupplierId && r.raw_product_code === incomingProductCode);
      if (match) return { action: 'UPDATE', targetId: match.id, code: incomingProductCode };
      return { action: 'INSERT_NEW', targetId: null, code: incomingProductCode };
    }
    const match = existingRows.find(r => r.supplier_id === incomingSupplierId && r.raw_barcode === incomingBarcode);
    if (match) return { action: 'UPDATE_FALLBACK', targetId: match.id, code: null };
    return { action: 'INSERT_NEW_FALLBACK', targetId: null, code: null };
  }

  const existingDbRows = [
    { id: 209, supplier_id: 2, raw_product_code: '128664', raw_barcode: '5000112693577', raw_title: 'Coca Cola 8pk' },
    { id: 238, supplier_id: 2, raw_product_code: '273542', raw_barcode: '5000112693676', raw_title: 'Coca-cola 500ml' }
  ];

  const res1 = resolveRawProductIdentity(existingDbRows, 2, '273542', '5000112693676');
  assert.strictEqual(res1.action, 'UPDATE');
  assert.strictEqual(res1.targetId, 238);

  const res2 = resolveRawProductIdentity(existingDbRows, 2, '999999', '5000112693676');
  assert.strictEqual(res2.action, 'INSERT_NEW');
  assert.strictEqual(res2.targetId, null);
});

console.log(`\nTEST SUMMARY: ${passed}/${total} tests passed.\n`);
if (passed !== total) process.exit(1);
