const assert = require('assert');
const ProductMetadataParser = require('../utils/ProductMetadataParser');

function simulateBookerDomExtraction(htmlString, href, code) {
  // Simulates the exact updated extraction logic inside bookerScraper.js
  const titleMatch = htmlString.match(/<a[^>]*class="tw:line-clamp-3"[^>]*>([^<]+)<\/a>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const packMatch = htmlString.match(/(Case of \d+ x \d+ml|\d+ x \d+ml)/i);
  const packInfo = packMatch ? packMatch[1].trim() : null;

  const rawUrl = href;

  // Extract canonical EX-VAT wholesale case price
  let price = null;

  // Strategy A & B: Price preceding incl. VAT
  const vatRegexMatch = htmlString.match(/£\s*([0-9]+\.[0-9]{2})\s*(?:<[^>]+>|\s)*(?:£[0-9.]+\s*)?incl\.?\s*vat/i);
  if (vatRegexMatch) {
    price = parseFloat(vatRegexMatch[1]);
  }

  const caseQuantity = ProductMetadataParser.extractQuantity(packInfo) || ProductMetadataParser.extractQuantity(title) || 1;
  const unitCost = price && caseQuantity > 0 ? parseFloat((price / caseQuantity).toFixed(4)) : null;

  return {
    supplierProductId: code,
    rawTitle: title,
    rawUrl: rawUrl,
    rawPackInfo: packInfo,
    casePrice: price,
    caseQuantity: caseQuantity,
    unitPrice: unitCost
  };
}

function runRegressionTests() {
  console.log('=== RUNNING BOOKER PRICE & URL EXTRACTION REGRESSION TESTS ===');

  const sampleBookerHtml = `
    <div class="product-card">
      <a href="/products/product?Code=291814&itemHierarchy=Lucozade" class="tw:line-clamp-3">Lucozade Energy Drink Orange 500ml PMP £1.50</a>
      <ul><li>Case of 24 x 500ml</li></ul>
      <div>Was £19.29</div>
      <div>Save £1.70</div>
      <div>£1.50 PM</div>
      <div>41.4% POR</div>
      <p class="tw:text-3xl tw:font-semibold">£17.59</p>
      <span class="tw:text-lg">£21.11 incl. VAT</span>
    </div>
  `;
  const sampleUrl = 'https://www.booker.co.uk/products/product?Code=291814';

  const result = simulateBookerDomExtraction(sampleBookerHtml, sampleUrl, '291814');

  console.log('Extracted Case Price:', result.casePrice);
  console.log('Extracted Case Quantity:', result.caseQuantity);
  console.log('Calculated Unit Price:', result.unitPrice);
  console.log('Extracted Product URL:', result.rawUrl);

  assert.strictEqual(result.casePrice, 17.59, 'Case price must equal £17.59 (EX-VAT)');
  assert.strictEqual(result.caseQuantity, 24, 'Case quantity must equal 24');
  assert.ok(Math.abs(result.unitPrice - 0.7329) < 0.001, 'Unit price must be approximately 0.733');
  assert.strictEqual(result.rawUrl, sampleUrl, 'Product URL must equal valid Booker detail URL');

  console.log('\n✓ ALL BOOKER REGRESSION TESTS PASSED SUCCESSFULLY!');
}

runRegressionTests();
