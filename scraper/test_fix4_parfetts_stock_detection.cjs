/**
 * FIX 4 — Parfetts Stock Detection Unit & Regression Test
 *
 * Validates multi-signal stock detection logic across all required scenarios:
 * 1. Known in-stock product
 * 2. Known out-of-stock product
 * 3. Disabled button
 * 4. Quantity input available
 * 5. Conflicting indicators (e.g. OOS text + enabled button) -> returns null (UNKNOWN)
 * 6. Unknown state (e.g. price exists, but no stock signals) -> returns null (UNKNOWN)
 *
 * NO database writes. NO network requests. Pure unit tests.
 */

'use strict';

const ProductMetadataParser = require('./utils/ProductMetadataParser.js');

/**
 * Evaluates stock status for Parfetts products using multi-signal DOM indicators.
 */
function detectParfettsStockStatus(signals) {
  if (!signals || typeof signals !== 'object') return null;

  const {
    text = '',
    hasOutOfStockText = false,
    hasInStockText = false,
    hasDisabledAddBtn = false,
    hasEnabledAddBtn = false,
    hasQuantityInput = false,
    hasAltProductsBtn = false,
  } = signals;

  const lowerText = (text || '').toLowerCase();

  // Priority 1: Explicit Out of Stock indicators
  const isExplicitOOS = hasOutOfStockText ||
    lowerText.includes('out of stock') ||
    lowerText.includes('currently unavailable') ||
    lowerText.includes('discontinued') ||
    hasAltProductsBtn;

  // Priority 2: Disabled purchase button
  const isDisabledBtn = hasDisabledAddBtn;

  // Priority 3: Explicit In Stock / Low Stock text
  const isExplicitInStock = hasInStockText ||
    lowerText.includes('in stock') ||
    lowerText.includes('low stock');

  // Priority 4: Enabled Add to Trolley button
  const isEnabledAddBtn = hasEnabledAddBtn && !hasAltProductsBtn;

  // Priority 5: Quantity input available
  const isQtyInputAvailable = hasQuantityInput;

  // Count positive vs negative signals
  const negativeSignals = [isExplicitOOS, isDisabledBtn].filter(Boolean).length;
  const positiveSignals = [isExplicitInStock, isEnabledAddBtn, isQtyInputAvailable].filter(Boolean).length;

  // Conflict Resolution:
  // If negative and positive signals both exist -> CONFLICT -> return null (UNKNOWN)
  if (negativeSignals > 0 && positiveSignals > 0) {
    return null;
  }

  // If negative signals present -> return false (Out of Stock / Unavailable)
  if (negativeSignals > 0) {
    return false;
  }

  // If positive signals present -> return true (In Stock)
  if (positiveSignals > 0) {
    return true;
  }

  // No stock signals present -> return null (UNKNOWN). Never guess based on price!
  return null;
}

const TEST_CASES = [
  {
    name: '1. Known in-stock product ("In Stock: 304" + enabled Add button)',
    signals: {
      text: 'Coca Cola Zero Sugar Pm £1.40 500ML In Stock: 304',
      hasInStockText: true,
      hasEnabledAddBtn: true,
    },
    expected: true,
    note: 'In-stock text + enabled Add button -> true',
  },
  {
    name: '2. Known out-of-stock product ("Out of stock" + "View Alternative Products")',
    signals: {
      text: 'Coca Cola Lime Pm £1.85 500ML Out of stock',
      hasOutOfStockText: true,
      hasAltProductsBtn: true,
    },
    expected: false,
    note: 'OOS text + alternative products button -> false',
  },
  {
    name: '3. Disabled button (button[disabled])',
    signals: {
      text: 'Product with disabled button',
      hasDisabledAddBtn: true,
    },
    expected: false,
    note: 'Disabled button -> false',
  },
  {
    name: '4. Quantity input available (enabled number input)',
    signals: {
      text: 'Product with quantity input',
      hasQuantityInput: true,
    },
    expected: true,
    note: 'Quantity input available -> true',
  },
  {
    name: '5. Conflicting indicators (OOS text BUT enabled Add button)',
    signals: {
      text: 'Out of stock item with stray button',
      hasOutOfStockText: true,
      hasEnabledAddBtn: true,
    },
    expected: null,
    note: 'Conflicting signals -> null (UNKNOWN)',
  },
  {
    name: '6. Unknown state (price exists = £12.99, but zero stock signals)',
    signals: {
      text: 'Item title £12.99 Pack Size 1x12', // Price exists, but no stock text, no button, no input
    },
    expected: null,
    note: 'Zero stock signals (price exists) -> null (UNKNOWN), never guess true!',
  },
  {
    name: '7. Discontinued product ("Discontinued")',
    signals: {
      text: 'Discontinued product line',
      hasOutOfStockText: true,
    },
    expected: false,
    note: 'Discontinued -> false',
  },
];

console.log('=== FIX 4 PARFETTS STOCK DETECTION UNIT TESTS ===\n');

let allPass = true;
const rows = [];

for (const tc of TEST_CASES) {
  const result = detectParfettsStockStatus(tc.signals);
  const pass = result === tc.expected;
  if (!pass) allPass = false;

  rows.push({
    name: tc.name,
    result: result === null ? 'null (UNKNOWN)' : String(result),
    expected: tc.expected === null ? 'null (UNKNOWN)' : String(tc.expected),
    pass: pass ? '✅ PASS' : '❌ FAIL',
    note: tc.note,
  });
}

console.log('| Scenario | Result | Expected | Status | Note |');
console.log('| :--- | :--- | :--- | :-: | :--- |');
for (const r of rows) {
  console.log(`| ${r.name} | ${r.result} | ${r.expected} | ${r.pass} | ${r.note} |`);
}

console.log(`\nOverall: ${allPass ? '✅ ALL ' + rows.length + ' TESTS PASS' : '❌ SOME TESTS FAILED'}`);

module.exports = { detectParfettsStockStatus };
