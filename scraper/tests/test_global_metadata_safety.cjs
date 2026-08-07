/**
 * Global Metadata Layer Safety Unit Tests (Maintenance Test)
 */

const path = require('path');
const fs = require('fs');

const rootEnv = path.join(__dirname, '../../.env');
const scraperEnv = path.join(__dirname, '../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });
else require('dotenv').config({ path: scraperEnv });

const GlobalMetadataLayer = require('../services/GlobalMetadataLayer');
const CostcoScraper = require('../scrapers/costcoScraper');

async function runSafetyTests() {
  console.log('=== GLOBAL METADATA LAYER SAFETY UNIT TESTS ===\n');

  const gml = new GlobalMetadataLayer();
  const costco = new CostcoScraper();

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✅ Test ${totalTests} Passed: ${message}`);
      passedTests++;
    } else {
      console.error(`❌ Test ${totalTests} Failed: ${message}`);
    }
  }

  gml.seedVerifiedMetadata([
    {
      barcode: '5000112693577',
      source_product_name: 'COCA COLA £1.15',
      normalized_brand: 'coca cola',
      normalized_volume: '330ml',
      verification_status: 'verified',
    },
    {
      barcode: '005000112693577',
      source_product_name: 'COCA COLA WITH LEADING ZERO',
      normalized_brand: 'coca cola',
      normalized_volume: '330ml',
      verification_status: 'verified',
    },
    {
      barcode: '9999999999999',
      source_product_name: 'CONFLICTING ITEM',
      normalized_brand: 'conflicting',
      normalized_volume: '500ml',
      verification_status: 'needs_review',
    }
  ]);

  const item1 = await gml.enrichProduct({ barcode: '5000112693577', product_name: 'COCA COLA £1.15' });
  assert(item1.volume === '330ml' && item1.product_name === 'COCA COLA £1.15', 'Verified barcode provides volume 330ml');

  const item2 = await gml.enrichProduct({ barcode: '7777777777777', product_name: 'UNKNOWN PRODUCT' });
  assert(item2.volume === null && item2.brand === null, 'Missing metadata falls back to un-enriched original state');

  const item3 = await gml.enrichProduct({ barcode: '9999999999999', product_name: 'CONFLICTING ITEM' });
  assert(item3.volume === null, 'Metadata marked needs_review is NOT auto-used');

  const normBc = GlobalMetadataLayer.normalizeBarcode('005000112693577');
  const item4 = await gml.enrichProduct({ barcode: '005000112693577', product_name: 'COCA COLA WITH LEADING ZERO' });
  assert(normBc === '005000112693577' && item4.barcode === '005000112693577', 'Leading zeroes on barcodes are preserved exactly');

  const explicitVol = GlobalMetadataLayer.extractExplicitVolume('COCA COLA £1.15');
  assert(explicitVol === null, 'Price mark £1.15 is NEVER parsed as volume unit');

  const evalSuccess = costco.evaluateCandidate(
    { product_name: 'COCA COLA 330ml', brand: 'coca cola', volume: '330ml' },
    { rawTitle: 'Coca Cola, 30 x 330ml' },
    'exact_name'
  );
  assert(evalSuccess.validation_score === 95 && evalSuccess.result_status === 'success', 'Previously successful matches remain SUCCESS');

  const evalRejected = costco.evaluateCandidate(
    { product_name: 'MONSTER ENERGY 500ml', brand: 'monster', volume: '500ml' },
    { rawTitle: 'LG 34 Inch WQHD 100Hz VA UltraWide Monitor' },
    'exact_name'
  );
  assert(evalRejected.validation_score === 0 && evalRejected.result_status === 'rejected', 'Cross-category false positives remain REJECTED');

  console.log(`\n============================================================`);
  console.log(`SAFETY TESTS RESULT: ${passedTests === totalTests ? '✅ ALL 7 SAFETY TESTS PASSED' : '❌ SAFETY TESTS FAILED'}`);
  console.log(`============================================================\n`);
}

runSafetyTests().catch(err => {
  console.error('Fatal error in safety unit tests:', err);
  process.exit(1);
});
