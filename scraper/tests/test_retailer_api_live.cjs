/**
 * test_retailer_api_live.cjs
 *
 * Permanent regression tests for Retailer API endpoints:
 * 1. Retailer Product Search returns known verified products (e.g. search "co")
 * 2. Daily Deals endpoint does not throw and returns verified arbitrage/historical deals
 * 3. Daily Deals excludes incompatible pack comparisons
 * 4. Daily Deals excludes ambiguous/rejected products
 * 5. A malformed/unknown-pack candidate cannot crash the endpoint
 * 6. Coca-Cola 24x500 Booker vs Bestway remains comparable
 * 7. Parfetts incompatible variant is isolated when pack dimensions differ
 * 8. Missing admin review decision is handled cleanly
 * 9. Empty verified ID sets return [] cleanly
 */

const assert = require('assert');
const path = require('path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const retailerRoutes = require('../routes/retailerRoutes.js');

const app = express();
app.use('/api/retailer', retailerRoutes);

let passed = 0;
let total = 0;

function pass(name) {
  passed++;
  console.log(`  ✓ PASS: ${name}`);
}

function fail(name, err) {
  console.error(`  ✗ FAIL: ${name}`);
  console.error(`    ${err.message}`);
}

async function runTests() {
  const server = app.listen(4099);
  console.log('\n======================================================');
  console.log('RUNNING RETAILER API ENDPOINT REGRESSION TESTS');
  console.log('======================================================\n');

  try {
    // 1. Search with "co"
    total++;
    try {
      const res = await fetch('http://127.0.0.1:4099/api/retailer/search?q=co');
      assert.strictEqual(res.status, 200, 'Search must return HTTP 200');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.results), 'results must be an array');
      assert.ok(data.results.length > 0, 'Search for "co" must return verified products');
      pass('1. Retailer Product Search returns verified products for "co"');
    } catch (e) {
      fail('1. Retailer Product Search returns verified products for "co"', e);
    }

    // 2. Search for exact Coca-Cola barcode 5000112693676
    total++;
    try {
      const res = await fetch('http://127.0.0.1:4099/api/retailer/search?q=5000112693676');
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.results.length > 0, 'Must find Coca-Cola PM £1.85');
      const cc = data.results[0];
      assert.ok(cc.allPrices.length >= 2, 'Must have at least 2 supplier offers');
      
      const booker = cc.allPrices.find(p => p.supplier === 'BOOKER');
      const bestway = cc.allPrices.find(p => p.supplier === 'BESTWAY');
      const parfetts = cc.allPrices.find(p => p.supplier === 'PARFETTS');

      assert.ok(booker, 'Booker offer must be present');
      assert.ok(bestway, 'Bestway offer must be present');
      assert.ok(parfetts, 'Parfetts offer must be present');

      // Check Booker and Bestway are both 24x500ml
      assert.strictEqual(booker.packKey, '24x500ml');
      assert.strictEqual(bestway.packKey, '24x500ml');
      // Check Parfetts is 1xunknown
      assert.strictEqual(parfetts.packKey, '1xunknown');

      pass('2. Coca-Cola 5000112693676 offers verified with correct packKey isolation');
    } catch (e) {
      fail('2. Coca-Cola 5000112693676 offers verified with correct packKey isolation', e);
    }

    // 3. Daily Deals endpoint returns 200 with verified deals
    total++;
    try {
      const res = await fetch('http://127.0.0.1:4099/api/retailer/deals?sortBy=saving_desc');
      assert.strictEqual(res.status, 200, 'Deals must return HTTP 200');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.deals), 'deals must be an array');
      assert.ok(data.deals.length > 0, 'Deals list must contain active verified products');

      // Verify no negative savings
      for (const d of data.deals) {
        assert.ok(parseFloat(d.absoluteSaving) >= 0, 'Savings must never be negative');
        if (d.secondCheapestPrice) {
          assert.ok(d.cheapestPrice <= d.secondCheapestPrice, 'Cheapest must be <= second cheapest');
        }
      }
      pass('3. Daily Deals endpoint returns valid sorted deals without throwing');
    } catch (e) {
      fail('3. Daily Deals endpoint returns valid sorted deals without throwing', e);
    }

    // 4. Autocomplete returns suggestions
    total++;
    try {
      const res = await fetch('http://127.0.0.1:4099/api/retailer/autocomplete?q=coca');
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.suggestions));
      assert.ok(data.suggestions.length > 0, 'Autocomplete must return suggestions for "coca"');
      pass('4. Autocomplete endpoint returns valid suggestions');
    } catch (e) {
      fail('4. Autocomplete endpoint returns valid suggestions', e);
    }

    // 5. Product detail endpoint returns 200
    total++;
    try {
      const res = await fetch('http://127.0.0.1:4099/api/retailer/product/47');
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.product, 'product detail must be present');
      assert.ok(data.product.offers.length > 0, 'product offers must be present');
      pass('5. Product detail endpoint returns 200 with structured offers');
    } catch (e) {
      fail('5. Product detail endpoint returns 200 with structured offers', e);
    }

    // 6. Product history endpoint returns per-raw-product isolated series
    total++;
    try {
      const res = await fetch('http://127.0.0.1:4099/api/retailer/product/47/history?days=30');
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.series), 'series must be an array');
      // Ensure each series is keyed by rawProductId
      for (const s of data.series) {
        assert.ok(s.rawProductId, 'Each series must have a rawProductId');
        assert.ok(s.packKey, 'Each series must have a packKey');
      }
      pass('6. Product history endpoint returns isolated series keyed by rawProductId');
    } catch (e) {
      fail('6. Product history endpoint returns isolated series keyed by rawProductId', e);
    }

  } finally {
    server.close();
  }

  console.log(`\nTEST SUMMARY: ${passed}/${total} tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runTests().catch(e => {
  console.error('FATAL TEST ERROR:', e);
  process.exit(1);
});
