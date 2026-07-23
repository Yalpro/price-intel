const fs = require('fs');
const csv = require('csv-parser');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const ProductMetadataParser = require('../utils/ProductMetadataParser');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const runLocks = {};

class BaseScraper {
  constructor(supplierName) {
    this.supplierName = supplierName;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.runId = null;
    this.startTime = null;
    this.supplierRow = null;
    
    this.stats = {
      attemptedCount: 0,
      successfulPriceCount: 0,
      missingPackCount: 0,
      errorCount: 0,
    };
    
    // Default capabilities, to be overridden by subclasses
    this.capabilities = {
      supportsBarcodeSearch: true,
      supportsNameSearch: true,
      supportsDirectProductRedirect: true,
      supportsMultipleResults: true,
      supportsStockStatus: true,
      supportsPromotionBadges: true,
      exposesBarcodesInDOM: true,
    };
  }

  async delay(ms = 2000) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async loadProductsFromCsv(filePath) {
    const results = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async getSupplierRow() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id')
      .eq('name', this.supplierName)
      .single();

    if (error || !data) {
      throw new Error(`Supplier ${this.supplierName} not found in DB.`);
    }
    this.supplierRow = data;
  }

  async initRun() {
    if (runLocks[this.supplierName]) {
      throw new Error(`A scraper run for ${this.supplierName} is already in progress.`);
    }
    runLocks[this.supplierName] = true;

    await this.getSupplierRow();

    const { data: runData, error: runError } = await supabase
      .from('scraper_runs')
      .insert({
        supplier_id: this.supplierRow.id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      runLocks[this.supplierName] = false;
      throw new Error(`Failed to initialize run in DB: ${runError.message}`);
    }
    
    this.runId = runData.id;
    this.startTime = Date.now();
  }

  async finalizeRun(status, logMessage = '') {
    try {
      const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      await supabase
        .from('scraper_runs')
        .update({
          status,
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          attempted_count: this.stats.attemptedCount,
          successful_price_count: this.stats.successfulPriceCount,
          missing_pack_count: this.stats.missingPackCount,
          error_count: this.stats.errorCount,
          log: logMessage,
        })
        .eq('id', this.runId);
    } catch (err) {
      console.error(`Failed to update scraper_runs for ${this.runId}:`, err.message);
    } finally {
      runLocks[this.supplierName] = false;
      await this.close().catch(() => {});
    }
  }

  async logSearchResult(logData) {
    try {
      const { error } = await supabase.from('product_search_logs').insert(logData);
      if (error) {
        console.error(`[${this.supplierName}] Failed to insert search log:`, error.message);
      }
    } catch (err) {
      console.error(`[${this.supplierName}] Exception inserting search log:`, err.message);
    }
  }

  async captureDebugEvidence(pg, term, selectorUsed, candidateCount) {
    const evidence = {
      timestamp: new Date().toISOString(),
      supplier: this.supplierName,
      searchTerm: term,
      currentUrl: pg.url(),
      pageTitle: await pg.title(),
      selectorUsed,
      candidateCount,
      resultCountText: null,
    };

    try {
      const bodyText = await pg.innerText('body');
      const countMatch = bodyText.match(/(\d+)\s*results?\s*found/i);
      if (countMatch) evidence.resultCountText = countMatch[0];

      if (process.env.SCRAPER_DEBUG === 'true') {
        const screenshotPath = require('path').join(__dirname, '..', 'debug_output', `${this.supplierName}_${Date.now()}.png`);
        if (!fs.existsSync(require('path').dirname(screenshotPath))) {
            fs.mkdirSync(require('path').dirname(screenshotPath), { recursive: true });
        }
        await pg.screenshot({ path: screenshotPath, fullPage: true });
        evidence.screenshotPath = screenshotPath;
      }
    } catch (e) {
        console.error(`[${this.supplierName}] Error capturing debug evidence:`, e.message);
    }

    console.warn(`[${this.supplierName}] DEBUG EVIDENCE:`, JSON.stringify(evidence, null, 2));
    return evidence;
  }

  validateCandidates(csvProduct, candidates, strategy) {
    let bestCandidate = null;
    let highestScore = -1;
    let isTie = false;

    for (const candidate of candidates) {
      const evaluation = this.evaluateCandidate(csvProduct, candidate, strategy);
      
      if (evaluation.validation_score > highestScore) {
        highestScore = evaluation.validation_score;
        bestCandidate = { ...candidate, ...evaluation };
        isTie = false;
      } else if (evaluation.validation_score === highestScore && highestScore > 0) {
        isTie = true;
      }
    }

    if (!bestCandidate) {
      return { result_status: 'not_found', validation_score: 0, validation_reason: 'No candidates found.' };
    }

    if (isTie && highestScore < 100) {
      bestCandidate.result_status = 'ambiguous';
      bestCandidate.validation_reason = 'Multiple candidates tied with the highest valid score.';
    }

    return bestCandidate;
  }

  evaluateCandidate(csvProduct, candidate, strategy) {
    const csvBarcode = ProductMetadataParser.normalizeBarcode(csvProduct.barcode);
    const candidateBarcode = ProductMetadataParser.normalizeBarcode(candidate.rawBarcode);

    // 1. Barcode check
    if (csvBarcode && candidateBarcode) {
      if (csvBarcode === candidateBarcode) {
        return { result_status: 'success', validation_score: 100, validation_reason: 'Exact normalized barcode match.', matched_fields: 'barcode' };
      } else if (candidateBarcode.length > 7) {
        return { result_status: 'rejected', validation_score: 0, validation_reason: `Conflicting barcode: Expected ${csvBarcode}, got ${candidateBarcode}.`, conflicting_fields: 'barcode' };
      }
    }

    // 2. Metadata check
    const csvName = csvProduct.product_name;
    const candName = candidate.rawTitle || '';
    
    const csvBrand = ProductMetadataParser.extractBrand(csvName);
    const candBrand = ProductMetadataParser.extractBrand(candName);
    
    const csvVol = ProductMetadataParser.extractVolume(csvName);
    const candVol = ProductMetadataParser.extractVolume(candName);
    
    const csvWeight = ProductMetadataParser.extractWeight(csvName);
    const candWeight = ProductMetadataParser.extractWeight(candName);
    
    const csvPack = ProductMetadataParser.extractPackSize(csvName);
    const candPack = ProductMetadataParser.extractPackSize(candName) || ProductMetadataParser.extractPackSize(candidate.rawPackInfo);

    const conflicts = [];
    const matched = [];

    // Conflict detection (Strict rejections)
    if (csvBrand && candBrand && csvBrand !== candBrand) conflicts.push('brand');
    if (csvVol && candVol && csvVol !== candVol) conflicts.push('volume');
    if (csvWeight && candWeight && csvWeight !== candWeight) conflicts.push('weight');
    if (csvPack && candPack && csvPack !== candPack) conflicts.push('pack');

    if (conflicts.length > 0) {
      return { result_status: 'rejected', validation_score: 0, validation_reason: `Metadata conflicts detected.`, conflicting_fields: conflicts.join(',') };
    }

    // Match detection (Only explicit matches count)
    if (csvBrand && candBrand && csvBrand === candBrand) matched.push('brand');
    if (csvVol && candVol && csvVol === candVol) matched.push('volume');
    if (csvWeight && candWeight && csvWeight === candWeight) matched.push('weight');
    if (csvPack && candPack && csvPack === candPack) matched.push('pack');

    const brandMatched = matched.includes('brand');
    const volOrWeightMatched = matched.includes('volume') || matched.includes('weight');
    const packMatched = matched.includes('pack');

    let score = 50; // Default rejected if nothing explicitly matches

    if (brandMatched && volOrWeightMatched && packMatched) {
      score = 90; // Success threshold reached
    } else if (brandMatched && (volOrWeightMatched || packMatched)) {
      score = 80; // Ambiguous
    } else if (brandMatched) {
      score = 70; // Ambiguous
    } else if (ProductMetadataParser.normalizeText(csvName) === ProductMetadataParser.normalizeText(candName)) {
      score = 85; // Exact title match but missing explicit metadata = strong ambiguous
    } else if (volOrWeightMatched || packMatched) {
      score = 60; // Weak ambiguous
    }

    // Barcode strategy boost
    if (strategy === 'barcode' || strategy === 'normalized_barcode') {
      if (score >= 90) {
        score = Math.min(99, score + 5); // Increase confidence for an already successful match
      } else {
        score = Math.min(89, score + 15); // Cannot cross the 90 Success threshold!
      }
      matched.push('supplier_barcode_search');
    }

    let status = 'rejected';
    if (score >= 90) status = 'success';
    else if (score >= 60) status = 'ambiguous';

    return {
      result_status: status,
      validation_score: score,
      validation_reason: `Evaluated with score ${score}.`,
      matched_fields: matched.join(',')
    };
  }

  async processProduct(product, page) {
    this.stats.attemptedCount++;
    const now = new Date().toISOString();

    const strategies = [];
    
    if (this.capabilities.supportsBarcodeSearch) {
      if (product.barcode) strategies.push({ type: 'barcode', term: product.barcode });
      
      const normBarcode = ProductMetadataParser.normalizeBarcode(product.barcode);
      if (normBarcode && normBarcode !== product.barcode) strategies.push({ type: 'normalized_barcode', term: normBarcode });
    }
    
    if (this.capabilities.supportsNameSearch) {
      if (product.product_name) strategies.push({ type: 'exact_name', term: product.product_name });
      
      const cleanName = ProductMetadataParser.cleanName(product.product_name);
      if (cleanName && cleanName !== product.product_name) strategies.push({ type: 'cleaned_name', term: cleanName });
      
      const brandCore = ProductMetadataParser.extractBrand(product.product_name);
      if (brandCore && brandCore !== cleanName) strategies.push({ type: 'brand_core', term: brandCore });
    }

    let finalResult = null;
    let attemptNumber = 1;

    console.log(`\n[${this.supplierName}] Processing: ${product.product_name} (${product.barcode})`);

    for (const strategy of strategies) {
      const searchStart = Date.now();
      let candidates = [];
      let errorMessage = null;

      console.log(`[${this.supplierName}]   -> Attempt ${attemptNumber} (${strategy.type}): "${strategy.term}"`);

      try {
        candidates = await this.executeSearch(page, strategy.term, strategy.type);
        if (!Array.isArray(candidates)) {
           candidates = candidates ? [candidates] : [];
        }
      } catch (err) {
        errorMessage = err.message;
      }

      const searchDuration = Date.now() - searchStart;
      let evaluated;

      if (errorMessage) {
        evaluated = { result_status: 'error', validation_score: 0, validation_reason: errorMessage };
      } else {
        evaluated = this.validateCandidates(product, candidates, strategy.type);
      }

      console.log(`[${this.supplierName}]      Result: ${evaluated.result_status.toUpperCase()} (Score: ${evaluated.validation_score}) - ${evaluated.validation_reason}`);

      // Attempt-level robust logging
      await this.logSearchResult({
        scraper_run_id: this.runId,
        supplier_id: this.supplierRow.id,
        source_catalogue_key: product.barcode || product.product_name,
        barcode: product.barcode,
        original_product_name: product.product_name,
        attempt_number: attemptNumber,
        search_strategy: strategy.type,
        searched_term: strategy.term,
        result_status: evaluated.result_status,
        validation_score: evaluated.validation_score,
        validation_reason: evaluated.validation_reason,
        conflicting_fields: evaluated.conflicting_fields,
        matched_fields: evaluated.matched_fields,
        matched_supplier_product_title: evaluated.rawTitle,
        matched_supplier_barcode: evaluated.rawBarcode,
        candidate_count: candidates.length,
        search_duration_ms: searchDuration,
        error_message: errorMessage,
      });

      if (evaluated.result_status === 'success') {
        finalResult = evaluated;
        break; // Stop searching! We found it deterministically.
      }

      attemptNumber++;
      await this.delay(1000); // polite pause between attempts
    }

    if (finalResult) {
      try {
        const rawTitle = finalResult.rawTitle || product.product_name;
        const rawPackInfo = finalResult.rawPackInfo || null;

        const { data: rawProduct, error: rawError } = await supabase
          .from('raw_products')
          .upsert(
            {
              supplier_id: this.supplierRow.id,
              raw_title: rawTitle,
              raw_barcode: product.barcode,
              raw_pack_info: rawPackInfo,
              scraped_at: now,
            },
            { onConflict: 'supplier_id,raw_barcode' }
          )
          .select()
          .single();

        if (rawError) throw new Error(`raw_products upsert failed: ${rawError.message}`);

        const { error: snapError } = await supabase.from('price_snapshots').insert({
          canonical_product_id: null,
          supplier_id: this.supplierRow.id,
          case_price: finalResult.price,
          unit_cost: null,
          in_stock: finalResult.inStock,
          promotion_flag: finalResult.promotionFlag || false,
          snapshot_at: now,
        });

        if (snapError) throw new Error(`price_snapshots insert failed: ${snapError.message}`);

        if (finalResult.price !== null && finalResult.inStock) {
          this.stats.successfulPriceCount++;
        }
        if (!rawPackInfo) {
          this.stats.missingPackCount++;
        }
      } catch (err) {
        this.stats.errorCount++;
        console.error(`[${this.supplierName}] ✗ Final DB Write Error:`, err.message);
      }
    } else {
      console.log(`[${this.supplierName}] ✗ Product completely not found after all attempts.`);
      // Optionally, you could still upsert the missing state to raw_products/snapshots 
      // if tracking missing items in the current schema is required.
    }
  }

  // To be overridden by child classes
  async executeSearch(pg, term, strategy) {
    throw new Error('executeSearch must be implemented by subclass.');
  }

  async login() {
    throw new Error('login must be implemented by subclass.');
  }

  async run(csvPath) {
    try {
      await this.initRun();
      console.log(`\n=== Started ${this.supplierName} Scraper (Run ID: ${this.runId}) ===`);

      const products = await this.loadProductsFromCsv(csvPath);
      console.log(`Loaded ${products.length} products.`);

      const page = await this.login();
      if (!page) {
        throw new Error('Login failed.');
      }

      for (const product of products) {
        await this.delay();
        await this.processProduct(product, page);
      }

      console.log(`\n=== Completed ${this.supplierName} Scraper ===`);
      await this.finalizeRun('success', 'Run completed successfully.');
      return this.stats;

    } catch (err) {
      console.error(`\n=== Failed ${this.supplierName} Scraper ===\n${err.message}`);
      if (this.runId) {
        await this.finalizeRun('failed', err.message);
      }
      throw err;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}

module.exports = { BaseScraper, runLocks };
