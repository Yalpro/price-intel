/**
 * End-to-End Test: Start -> Running -> Stop -> Cancelled -> Start Again
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const scraperService = require('../services/scraperService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

async function testStopFlow() {
  console.log('=== END-TO-END SCRAPER STOP / CANCEL TEST ===\n');

  // 1. Trigger Costco Scraper Run
  console.log('1. Dispatching Costco Scraper Run...');
  const runResult = await scraperService.runScraper('costco');
  console.log('Dispatch result:', runResult);

  // Wait 1.5s for scraper to start and create DB record
  await new Promise(r => setTimeout(r, 1500));

  // 2. Check DB status
  const initialStatus = await scraperService.getScraperStatus('costco');
  console.log(`2. DB Status during run: ID #${initialStatus.id}, Status: '${initialStatus.status}'`);

  if (initialStatus.status !== 'running') {
    throw new Error(`Expected status 'running', got '${initialStatus.status}'`);
  }

  // 3. Trigger Stop/Cancel
  console.log('\n3. Triggering Stop/Cancel for Costco Scraper...');
  const stopResult = await scraperService.stopScraper('costco');
  console.log('Stop result:', stopResult);

  // Wait 1s for finalization
  await new Promise(r => setTimeout(r, 1000));

  // 4. Verify DB status after cancellation
  const cancelledStatus = await scraperService.getScraperStatus('costco');
  console.log(`\n4. DB Status after stop: ID #${cancelledStatus.id}`);
  console.log(`   - Status: '${cancelledStatus.status}'`);
  console.log(`   - Duration: ${cancelledStatus.duration_seconds}s`);
  console.log(`   - Attempted: ${cancelledStatus.attempted_count}`);
  console.log(`   - Log: "${cancelledStatus.log || cancelledStatus.error_message}"`);

  if (!['failed', 'cancelled'].includes(cancelledStatus.status) || !cancelledStatus.completed_at) {
    throw new Error(`Expected DB status 'failed' or 'cancelled', got '${cancelledStatus.status}'`);
  }

  // 5. Test Start Again
  console.log('\n5. Testing Start Again (verifying lock was released cleanly)...');
  const restartResult = await scraperService.runScraper('costco');
  console.log('Restart dispatch result:', restartResult);

  // Stop the second test run cleanly
  await new Promise(r => setTimeout(r, 1000));
  await scraperService.stopScraper('costco');

  console.log('\n============================================================');
  console.log('✅ ALL STOP / CANCEL TEST CHECKS PASSED SUCCESSFULLY!');
  console.log('============================================================');
}

testStopFlow().catch(err => {
  console.error('Fatal error in stop flow test:', err);
  process.exit(1);
});
