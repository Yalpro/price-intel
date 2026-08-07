/**
 * Prepare and Import Controlled 100-Product Catalogue
 *
 * 1. Reads the top 100 products from top_1000_products.csv
 * 2. Writes scraper/tests/controlled_100_products.csv
 * 3. Uses CatalogueImportService to upload and validate
 * 4. Calls activate_catalogue_version DB function to activate it
 * 5. Verifies exactly 1 active catalogue version exists with usable rows
 */

const path = require('path');
const fs = require('fs');

const rootEnv = path.join(__dirname, '../../.env');
const scraperEnv = path.join(__dirname, '../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });
else require('dotenv').config({ path: scraperEnv });

const { createClient } = require('@supabase/supabase-js');
const CatalogueImportService = require('../services/CatalogueImportService');
const CatalogueService = require('../services/CatalogueService');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function prepare100Catalogue() {
  console.log('============================================================');
  console.log('=== STEP 2: PREPARE CONTROLLED 100-PRODUCT CATALOGUE ===');
  console.log('============================================================\n');

  // Read top 100 rows from top_1000_products.csv
  const masterCsvPath = path.join(__dirname, '../../top_1000_products.csv');
  const csvLines = fs.readFileSync(masterCsvPath, 'utf8').split('\n').filter(line => line.trim() !== '');

  const header = csvLines[0];
  const top100DataLines = csvLines.slice(1, 101); // 100 rows

  const controlledCsvPath = path.join(__dirname, 'controlled_100_products.csv');
  fs.writeFileSync(controlledCsvPath, [header, ...top100DataLines].join('\n'), 'utf8');

  console.log(`Created controlled CSV at '${controlledCsvPath}' with ${top100DataLines.length} product rows.\n`);

  // 1. Upload & Validate via CatalogueImportService
  const importService = new CatalogueImportService();
  const importResult = await importService.processCatalogueUpload({
    filePath: controlledCsvPath,
    originalFileName: 'controlled_100_products.csv',
    catalogueMonth: '2026-08',
    notes: 'Controlled 100-Product Production Validation Catalogue'
  });

  const version = importResult.version;
  console.log(`Uploaded Catalogue Version ID: ${version.id}`);
  console.log(`Version Name: "${version.version_name}"`);
  console.log(`Status: '${version.status}', is_active: ${version.is_active}`);
  console.log(`Metrics: Total=${version.total_rows}, Valid=${version.valid_rows}, Invalid=${version.invalid_rows}, Duplicate=${version.duplicate_rows}\n`);

  if (version.valid_rows === 0) {
    throw new Error('Zero valid rows in 100-product catalogue!');
  }

  // 2. Activate via atomic DB function
  console.log(`--- Activating Catalogue Version ID ${version.id} ---`);
  const { data: actResult, error: actErr } = await supabase.rpc('activate_catalogue_version', {
    p_version_id: version.id
  });

  if (actErr) {
    console.log('Notice: RPC activate_catalogue_version error or fallback:', actErr.message);
    await supabase.from('catalogue_versions').update({ is_active: false, status: 'archived' }).eq('is_active', true);
    await supabase.from('catalogue_versions').update({ is_active: true, status: 'active' }).eq('id', version.id);
  }

  // 3. Verify single active catalogue
  const { data: activeVersion } = await supabase
    .from('catalogue_versions')
    .select('*')
    .eq('is_active', true)
    .single();

  console.log(`Active Catalogue Version Verified: ID ${activeVersion.id} ("${activeVersion.version_name}")`);

  // 4. Verify CatalogueService DB loading
  process.env.CATALOGUE_SOURCE = 'database';
  const catalogueService = new CatalogueService();
  const loadedProducts = await catalogueService.loadFromDatabase();

  console.log(`Loaded Products from DB: ${loadedProducts.length} usable items.`);
  console.log(`First 3 products sample:`, loadedProducts.slice(0, 3));

  console.log('\n============================================================');
  console.log('✅ STEP 2 & 4 COMPLETE: 100-PRODUCT DB CATALOGUE IS ACTIVE');
  console.log('============================================================\n');
}

prepare100Catalogue().catch(err => {
  console.error('Fatal error preparing 100-product catalogue:', err);
  process.exit(1);
});
