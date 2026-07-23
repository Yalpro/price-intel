const ParfettsScraper = require('../scrapers/parfettsScraper');
const BookerScraper = require('../scrapers/bookerScraper');
const DhamechaScraper = require('../scrapers/dhamechaScraper');
const { runLocks } = require('../scrapers/BaseScraper');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Temporary for regression testing
const CSV_PATH = require('path').join(__dirname, '../test_regression.csv');

class ScraperService {
  getScraperInstance(supplierName) {
    const name = supplierName.toLowerCase();
    switch (name) {
      case 'parfetts':
        return new ParfettsScraper();
      case 'booker':
        return new BookerScraper();
      case 'dhamecha':
        return new DhamechaScraper();
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
