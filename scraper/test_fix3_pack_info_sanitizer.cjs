/**
 * FIX 3 — Pack Info Sanitizer Unit & Regression Test
 *
 * Verifies that embedded price text (e.g. "(£5.69)", "£14.99 incl VAT") is stripped
 * from raw_pack_info, while preserving valid pack formats (e.g. "1 x 12", "12 x 500ml", "Case of 24").
 * Also confirms invalid random text and price-only strings return null.
 *
 * NO database writes. NO browser. Pure parser validation.
 */

'use strict';

const ProductMetadataParser = require('./utils/ProductMetadataParser.js');

const TEST_CASES = [
  { input: '1 x 12 (£5.69)', expected: '1 x 12', note: 'Strip embedded price in parentheses' },
  { input: '12 x 500ml £14.99', expected: '12 x 500ml', note: 'Strip standalone price string' },
  { input: 'Case of 24', expected: 'Case of 24', note: 'Preserve Case of N format' },
  { input: '24 x 330ml', expected: '24 x 330ml', note: 'Preserve standard multi-pack volume' },
  { input: '6 x 1.5L', expected: '6 x 1.5L', note: 'Preserve decimal volume pack' },
  { input: '£5.69', expected: null, note: 'Price-only string must return null' },
  { input: '(£5.69)', expected: null, note: 'Price-only parenthesized string must return null' },
  { input: '£14.99 incl VAT', expected: null, note: 'Price + VAT text must return null' },
  { input: 'invalid random text', expected: null, note: 'Random non-pack string must return null' },
  { input: 'In Stock', expected: null, note: 'UI status text must return null' },
  { input: 'Go Local', expected: null, note: 'Brand name / UI heading text must return null' },
  { input: '1 x 12 (£5.69 incl VAT)', expected: '1 x 12', note: 'Strip price + VAT in parentheses' },
  { input: '24 pk (excl VAT £12.50)', expected: '24 pk', note: 'Strip excl VAT + price' },
];

console.log('=== FIX 3 PACK INFO SANITIZER TEST ===\n');

let allPass = true;
const rows = [];

for (const tc of TEST_CASES) {
  const result = ProductMetadataParser.sanitizePackInfo(tc.input);
  const pass = result === tc.expected;
  if (!pass) allPass = false;

  rows.push({
    input: tc.input,
    output: result,
    expected: tc.expected,
    pass: pass ? '✅ PASS' : '❌ FAIL',
    note: tc.note,
  });
}

console.log('| Input | Output | Expected | Result | Note |');
console.log('| :--- | :--- | :--- | :-: | :--- |');
for (const r of rows) {
  const outStr = r.output === null ? 'null' : `"${r.output}"`;
  const expStr = r.expected === null ? 'null' : `"${r.expected}"`;
  console.log(`| "${r.input}" | ${outStr} | ${expStr} | ${r.pass} | ${r.note} |`);
}

console.log(`\nOverall: ${allPass ? '✅ ALL ' + rows.length + ' TESTS PASS' : '❌ SOME TESTS FAILED'}`);
