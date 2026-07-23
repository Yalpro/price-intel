require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');
const cron = require('node-cron');

// Supabase setup — uses SERVICE_ROLE_KEY so it bypasses RLS for writes
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Utility: Random delay (human-like pacing)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (min = 3000, max = 8000) => {
  const waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay(waitTime);
};

// Load target products from CSV — returns array of { barcode, product_name }
const loadProductsFromCsv = (csvPath) => {
  return new Promise((resolve, reject) => {
    const products = [];
    if (!fs.existsSync(csvPath)) {
      console.warn(`CSV file not found at ${csvPath}. Cannot proceed without product list.`);
      return resolve([]);
    }
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        // Only include rows with a barcode (skip generic till buttons)
        const barcode = data.Barcode ? data.Barcode.toString().replace(/\.0$/, '').trim() : null;
        if (barcode) {
          products.push({
            barcode,
            product_name: data['Product Name'] || data.product_name || '',
            our_qty_sold: parseInt(data.total_qty || data.our_qty_sold || 0, 10),
          });
        }
      })
      .on('end', () => {
        // Sort by quantity sold descending, take top 200
        products.sort((a, b) => b.our_qty_sold - a.our_qty_sold);
        resolve(products.slice(0, 200));
      })
      .on('error', reject);
  });
};

// Look up the supplier_id for a given supplier name
const getSupplierByName = async (name) => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('name', name)
    .single();

  if (error || !data) {
    console.error(`Could not find supplier '${name}' in DB:`, error?.message);
    return null;
  }
  return data;
};

// Write a single scraped result into raw_products + price_snapshots
// Every call is a fresh INSERT — never updates existing rows.
const writeScrapeResult = async ({ supplierRow, barcode, result, productName }) => {
  const now = new Date().toISOString();

  // 1. Insert into raw_products
  const { data: rawProduct, error: rawError } = await supabase
    .from('raw_products')
    .insert({
      supplier_id: supplierRow.id,
      raw_title: result ? result.rawTitle : productName, // use scraped title if available
      raw_barcode: barcode,
      raw_pack_info: result ? result.rawPackInfo : null,
      scraped_at: now,
    })
    .select()
    .single();

  if (rawError) {
    console.error(`  ✗ raw_products insert failed for ${barcode}:`, rawError.message);
    return;
  }

  // 2. Insert into price_snapshots (append-only, never update)
  const { error: snapError } = await supabase.from('price_snapshots').insert({
    // canonical_product_id is null until product-matching pipeline runs
    canonical_product_id: null,
    supplier_id: supplierRow.id,
    case_price: result ? result.price : null,
    unit_cost: null, // computed after case_size is known via product matching
    in_stock: result ? result.inStock : false,
    promotion_flag: result ? (result.promotionFlag ?? false) : false,
    snapshot_at: now,
  });

  if (snapError) {
    console.error(`  ✗ price_snapshots insert failed for ${barcode}:`, snapError.message);
    return;
  }

  const statusStr = result ? `£${result.price} | in_stock=${result.inStock}` : 'not found';
  console.log(`  ✓ ${barcode} → ${statusStr}`);
};

const runScraper = async () => {
  console.log('========================================');
  console.log('Scraper run started:', new Date().toISOString());
  console.log('========================================');

  // 1. Load target product barcodes from CSV
  const products = await loadProductsFromCsv('../top_1000_products.csv');
  if (products.length === 0) {
    console.error('No products loaded. Aborting.');
    return;
  }
  console.log(`Loaded ${products.length} products from CSV.`);

  // 2. Define which scrapers to run this pass (Parfetts only for Step 2 verification)
  const parfettsScraper = require('./parfettsScraper');
  const scrapersConfig = [
    { name: 'parfetts', module: parfettsScraper },
    // Add booker, dhamecha, tesco etc. here once verified
  ];

  for (const { name, module: scraper } of scrapersConfig) {
    console.log(`\n--- Starting scraper: ${name} ---`);

    // Look up the supplier row (needed for supplier_id FK)
    const supplierRow = await getSupplierByName(name);
    if (!supplierRow) {
      console.error(`Skipping ${name} — supplier not found in DB.`);
      continue;
    }

    let page;
    try {
      page = await scraper.login();
      if (!page) {
        console.error(`Login failed for ${name}, skipping.`);
        continue;
      }

      let successCount = 0;
      let notFoundCount = 0;
      let errorCount = 0;

      for (const product of products) {
        await randomDelay(); // Human-like pacing between requests

        try {
          console.log(`Searching: ${product.barcode} (${product.product_name})`);
          const result = await scraper.searchByBarcode(page, product.barcode);

          await writeScrapeResult({
            supplierRow,
            barcode: product.barcode,
            result,       // null means not found — still recorded in raw_products
            productName: product.product_name,
          });

          if (result) successCount++;
          else notFoundCount++;

        } catch (err) {
          errorCount++;
          console.error(`  ✗ Error scraping ${product.barcode}:`, err.message);

          // Still write a raw_products record so we know we attempted this barcode
          await writeScrapeResult({
            supplierRow,
            barcode: product.barcode,
            result: null,
            productName: product.product_name,
          }).catch(() => {}); // Swallow secondary error — don't crash the loop
        }
      }

      console.log(`\n${name} summary: ${successCount} found | ${notFoundCount} not found | ${errorCount} errors`);

    } catch (err) {
      console.error(`Critical error in ${name} scraper:`, err.message);
    } finally {
      if (scraper.close) {
        await scraper.close();
      }
    }
  }

  console.log('\n========================================');
  console.log('Scraper run completed:', new Date().toISOString());
  console.log('========================================');
};

// Run immediately if executed directly; otherwise export for cron scheduler
if (require.main === module) {
  runScraper().catch((err) => {
    console.error('Unhandled error in scraper run:', err);
    process.exit(1);
  });
} else {
  // Run daily at 3am
  cron.schedule('0 3 * * *', () => {
    runScraper().catch(console.error);
  });
}

module.exports = { runScraper };
