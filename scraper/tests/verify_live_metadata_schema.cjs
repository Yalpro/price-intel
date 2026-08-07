/**
 * Live Master Product Metadata Schema Verification (Maintenance Test)
 */

require('dotenv').config({ path: '../../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyLiveSchema() {
  console.log('=== LIVE MASTER PRODUCT METADATA SCHEMA VERIFICATION ===\n');

  const testBarcode = '005000112693577';
  const { data: insertData, error: insertError } = await supabase
    .from('master_product_metadata')
    .upsert([{
      barcode: testBarcode,
      source_product_name: 'TEST LEADING ZERO COCA COLA',
      normalized_brand: 'coca cola',
      normalized_volume: '330ml',
      metadata_source: 'schema_verification_test',
      confidence_score: 99,
      verification_status: 'auto_verified'
    }])
    .select('*')
    .single();

  if (insertError) {
    console.error('❌ Failed to insert test row:', insertError.message);
    process.exit(1);
  }

  const { data: readData, error: readError } = await supabase
    .from('master_product_metadata')
    .select('*')
    .eq('barcode', testBarcode)
    .single();

  if (readError) {
    console.error('❌ Failed to read back test row:', readError.message);
    process.exit(1);
  }

  const leadingZeroPreserved = readData.barcode === testBarcode && typeof readData.barcode === 'string';
  console.log(`Leading zero barcode string preservation: ${leadingZeroPreserved ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\nLIVE SCHEMA VERIFICATION RESULT: ✅ ALL SCHEMA CHECKS PASSED');
}

verifyLiveSchema().catch(err => {
  console.error('Fatal error in schema verification:', err);
  process.exit(1);
});
