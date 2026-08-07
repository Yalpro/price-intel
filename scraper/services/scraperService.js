const ParfettsScraper = require('../scrapers/parfettsScraper');
const BookerScraper = require('../scrapers/bookerScraper');
const CostcoScraper = require('../scrapers/costcoScraper');
const BestwayScraper = require('../scrapers/bestwayScraper');
const { runLocks } = require('../scrapers/BaseScraper');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const fs = require('fs');
const path = require('path');

// Resolve master product catalogue path across local & Docker container paths
let CSV_PATH = path.join(__dirname, '../../top_1000_products.csv');
if (!fs.existsSync(CSV_PATH)) {
  const altPath = path.join(__dirname, '../top_1000_products.csv');
  const dataPath = path.join(__dirname, '../data/top_1000_products.csv');
  if (fs.existsSync(altPath)) CSV_PATH = altPath;
  else if (fs.existsSync(dataPath)) CSV_PATH = dataPath;
}

class ScraperService {
  getScraperInstance(supplierName) {
    const name = supplierName.toLowerCase();
    switch (name) {
      case 'parfetts':
        return new ParfettsScraper();
      case 'booker':
        return new BookerScraper();
      case 'costco':
        return new CostcoScraper();
      case 'bestway':
        return new BestwayScraper();
      default:
        throw new Error(`Scraper for supplier '${supplierName}' is not implemented.`);
    }
  }

  async runScraper(supplierName) {
    const key = supplierName.toLowerCase();

    if (runLocks[key]) {
      throw new Error(`A scraper for '${supplierName}' is already running.`);
    }

    const scraper = this.getScraperInstance(key);

    // Fire-and-forget: run() internally calls initRun(), handles locking, and finalizes.
    scraper.run(CSV_PATH).then((stats) => {
      console.log(`[${key}] Run completed. Stats:`, stats);
    }).catch((err) => {
      console.error(`[${key}] Run failed:`, err.message);
    });

    // Return immediately so HTTP response is fast
    return { message: `Scraper for '${supplierName}' dispatched successfully.` };
  }

  async getScraperStatus(supplierName) {
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('name', supplierName.toLowerCase())
      .single();

    if (supplierError || !supplier) {
      throw new Error(`Supplier '${supplierName}' not found.`);
    }

    const { data: runs, error } = await supabase
      .from('scraper_runs')
      .select('*')
      .eq('supplier_id', supplier.id)
      .order('started_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch scraper status: ${error.message}`);
    }

    if (!runs || runs.length === 0) {
      return { status: 'idle', message: 'No runs recorded for this supplier.' };
    }

    return runs[0];
  }
}

module.exports = new ScraperService();
