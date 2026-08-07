/**
 * CatalogueService
 *
 * Manages database-driven catalogue loading for production scraper execution.
 * Enforces strict single-active catalogue version validation, preserves string barcodes
 * with leading zeroes, and prevents silent filesystem CSV fallbacks in production.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

class CatalogueService {
  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    this.supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
  }

  /**
   * Safe string barcode normalization preserving leading zeroes.
   * e.g. "005000112693577" -> "005000112693577"
   */
  static normalizeBarcodeString(rawBarcode) {
    if (rawBarcode === undefined || rawBarcode === null) return '';
    let str = String(rawBarcode).trim();
    return str.replace(/^["']|["']$/g, '');
  }

  /**
   * Load active catalogue products based on process.env.CATALOGUE_SOURCE
   * In production (NODE_ENV=production or CATALOGUE_SOURCE=database): loads from Supabase DB.
   * In local testing (CATALOGUE_SOURCE=file): loads from filesystem CSV.
   */
  async loadActiveCatalogue(fallbackCsvPath = null) {
    const source = (process.env.CATALOGUE_SOURCE || 'database').toLowerCase();

    if (source === 'file') {
      console.log('[CatalogueService] CATALOGUE_SOURCE=file -> Loading catalogue from filesystem CSV...');
      return this.loadFromFile(fallbackCsvPath);
    }

    if (source !== 'database') {
      throw new Error(`Invalid CATALOGUE_SOURCE configuration: '${source}'. Allowed values: 'database', 'file'.`);
    }

    console.log('[CatalogueService] CATALOGUE_SOURCE=database -> Loading active catalogue from Supabase DB...');
    return this.loadFromDatabase();
  }

  /**
   * Database catalogue loader
   */
  async loadFromDatabase() {
    if (!this.supabase) {
      throw new Error('[CatalogueService] Production database connection error: Supabase credentials missing.');
    }

    // 1. Fetch active catalogue version
    const { data: activeVersions, error: versionError } = await this.supabase
      .from('catalogue_versions')
      .select('*')
      .eq('is_active', true);

    if (versionError) {
      throw new Error(`Failed to query active catalogue version: ${versionError.message}`);
    }

    if (!activeVersions || activeVersions.length === 0) {
      throw new Error('No active catalogue version found in database.');
    }

    if (activeVersions.length > 1) {
      throw new Error(`Invalid state: Multiple active catalogue versions (${activeVersions.length}) found in database.`);
    }

    const activeVersion = activeVersions[0];
    console.log(`[CatalogueService] Active catalogue version ID ${activeVersion.id}: "${activeVersion.version_name}"`);

    // 2. Fetch active items for the active version ordered by ID
    const { data: items, error: itemsError } = await this.supabase
      .from('catalogue_items')
      .select('*')
      .eq('version_id', activeVersion.id)
      .eq('active', true)
      .order('id', { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to fetch items for active catalogue version ${activeVersion.id}: ${itemsError.message}`);
    }

    if (!items || items.length === 0) {
      throw new Error(`Zero usable catalogue items found in active catalogue version ${activeVersion.id}.`);
    }

    console.log(`[CatalogueService] Successfully loaded ${items.length} catalogue items from database.`);

    // 3. Map to product objects preserving leading-zero string barcodes
    return items.map((item, index) => ({
      row_number: index + 1,
      barcode: CatalogueService.normalizeBarcodeString(item.barcode),
      product_name: String(item.name || '').trim(),
      source: 'database'
    }));
  }

  /**
   * Filesystem CSV catalogue loader (Fallback for local testing only)
   */
  async loadFromFile(csvPath) {
    if (!csvPath || !fs.existsSync(csvPath)) {
      throw new Error(`Filesystem CSV path '${csvPath}' does not exist.`);
    }

    return new Promise((resolve, reject) => {
      const results = [];
      let rowCount = 0;

      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (data) => {
          rowCount++;
          results.push({
            row_number: rowCount,
            barcode: CatalogueService.normalizeBarcodeString(data.barcode),
            product_name: String(data.product_name || data.name || '').trim(),
            source: 'filesystem_csv'
          });
        })
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  }
}

module.exports = CatalogueService;
