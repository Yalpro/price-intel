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
  constructor() {
    this.activeScrapers = {};
  }

  getActiveScrapers() {
    return Object.keys(this.activeScrapers).map(k => k.toLowerCase());
  }

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
    this.activeScrapers[key] = scraper;

    // Fire-and-forget execution with cleanup handler
    scraper.run(CSV_PATH)
      .then((stats) => {
        console.log(`[${key}] Run finished. Stats:`, stats);
      })
      .catch((err) => {
        console.error(`[${key}] Run error:`, err.message);
      })
      .finally(() => {
        delete this.activeScrapers[key];
        runLocks[key] = false;
      });

    return { message: `Scraper for '${supplierName}' dispatched successfully.` };
  }

  async stopScraper(supplierName) {
    const key = supplierName.toLowerCase();
    const activeScraper = this.activeScrapers[key];

    if (activeScraper) {
      activeScraper.cancel('Cancelled: Manually stopped by administrator');
      await activeScraper.close().catch(() => {});

      if (activeScraper.runId) {
        const durationSec = activeScraper.startTime ? Math.floor((Date.now() - activeScraper.startTime) / 1000) : 0;
        await supabase
          .from('scraper_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_seconds: durationSec,
            attempted_count: activeScraper.stats?.attemptedCount || 0,
            log: 'Cancelled: Manually stopped by administrator',
            error_message: 'Cancelled: Manually stopped by administrator'
          })
          .eq('id', activeScraper.runId);
      }

      delete this.activeScrapers[key];
      runLocks[key] = false;

      return { 
        message: `Scraper run ${activeScraper.runId ? '#' + activeScraper.runId : ''} for '${supplierName}' cancelled cleanly.`,
        runId: activeScraper.runId 
      };
    }

    // Fallback: Check if DB records a running status for this supplier
    const statusRecord = await this.getScraperStatus(key);
    if (statusRecord && statusRecord.status === 'running') {
      const durationSeconds = statusRecord.started_at
        ? Math.floor((Date.now() - new Date(statusRecord.started_at).getTime()) / 1000)
        : 0;

      await supabase
        .from('scraper_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          log: 'Cancelled: Manually stopped by administrator',
          error_message: 'Cancelled: Manually stopped by administrator'
        })
        .eq('id', statusRecord.id);

      runLocks[key] = false;
      return { 
        message: `Scraper run #${statusRecord.id} for '${supplierName}' marked as cancelled.`,
        runId: statusRecord.id 
      };
    }

    runLocks[key] = false;
    return { message: `Scraper for '${supplierName}' stopped.` };
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
