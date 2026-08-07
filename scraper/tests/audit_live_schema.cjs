/**
 * Live Database Schema Audit Script
 *
 * Inspects live Supabase tables:
 * - catalogue_versions
 * - catalogue_items
 * - catalogue_import_errors
 * - profiles
 * - master_product_metadata
 */

const path = require('path');
const fs = require('fs');

const rootEnv = path.join(__dirname, '../../.env');
const scraperEnv = path.join(__dirname, '../.env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });
else require('dotenv').config({ path: scraperEnv });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function auditLiveSchema() {
  console.log('=== PHASE 1: LIVE DATABASE SCHEMA AUDIT ===\n');

  // 1. Audit catalogue_versions
  const { data: catVers, error: catVersErr } = await supabase
    .from('catalogue_versions')
    .select('*')
    .limit(5);

  console.log('1. Table: public.catalogue_versions');
  console.log(`   Exists: ${!catVersErr ? 'YES' : 'NO (' + catVersErr.message + ')'}`);
  if (!catVersErr && catVers.length > 0) {
    console.log('   Sample Row Keys:', Object.keys(catVers[0]));
    console.log('   Sample Row:', catVers[0]);
  } else if (!catVersErr) {
    console.log('   Row Count: 0 rows (table exists, currently empty)');
  }

  // 2. Audit catalogue_items
  const { data: catItems, error: catItemsErr } = await supabase
    .from('catalogue_items')
    .select('*')
    .limit(5);

  console.log('\n2. Table: public.catalogue_items');
  console.log(`   Exists: ${!catItemsErr ? 'YES' : 'NO (' + catItemsErr.message + ')'}`);
  if (!catItemsErr && catItems.length > 0) {
    console.log('   Sample Row Keys:', Object.keys(catItems[0]));
    console.log('   Sample Row:', catItems[0]);
  } else if (!catItemsErr) {
    console.log('   Row Count: 0 rows (table exists, currently empty)');
  }

  // 3. Audit catalogue_import_errors
  const { data: catErrs, error: catErrsErr } = await supabase
    .from('catalogue_import_errors')
    .select('*')
    .limit(5);

  console.log('\n3. Table: public.catalogue_import_errors');
  console.log(`   Exists: ${!catErrsErr ? 'YES' : 'NO (' + catErrsErr.message + ')'}`);
  if (!catErrsErr && catErrs.length > 0) {
    console.log('   Sample Row Keys:', Object.keys(catErrs[0]));
  }

  // 4. Audit profiles
  const { data: profs, error: profsErr } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);

  console.log('\n4. Table: public.profiles');
  console.log(`   Exists: ${!profsErr ? 'YES' : 'NO (' + profsErr.message + ')'}`);
  if (!profsErr && profs.length > 0) {
    console.log('   Sample Row Keys:', Object.keys(profs[0]));
  }

  // 5. Audit master_product_metadata
  const { data: metaRows, error: metaErr } = await supabase
    .from('master_product_metadata')
    .select('*')
    .limit(5);

  console.log('\n5. Table: public.master_product_metadata');
  console.log(`   Exists: ${!metaErr ? 'YES' : 'NO (' + metaErr.message + ')'}`);
  if (!metaErr && metaRows.length > 0) {
    console.log('   Row Count (Sample 5 shown):', metaRows.length);
    console.log('   Sample Row Keys:', Object.keys(metaRows[0]));
  }
}

auditLiveSchema().catch(err => {
  console.error('Fatal error in schema audit:', err);
  process.exit(1);
});
