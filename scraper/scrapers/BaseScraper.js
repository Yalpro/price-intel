const fs = require('fs');
const csv = require('csv-parser');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const ProductMetadataParser = require('../utils/ProductMetadataParser');
const GlobalMetadataLayer = require('../services/GlobalMetadataLayer');
const CandidateResolverService = require('../services/CandidateResolverService');
const SearchRecoveryService = require('../services/SearchRecoveryService');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
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
    this.metadataLayer = new GlobalMetadataLayer();
    this.candidateResolver = new CandidateResolverService({ scraper: this });
    this.searchRecovery = new SearchRecoveryService({ candidateResolver: this.candidateResolver });
    this.isCancelled = false;
    this.cancellationReason = null;
    this.isFinalized = false;

    this.stats = {
      attemptedCount: 0,
      matchedCount: 0,
      pricedCount: 0,
      missingPriceCount: 0,
      inStockCount: 0,
      outOfStockCount: 0,
      unknownStockCount: 0,
      ambiguousCount: 0,
      rejectedCount: 0,
      notFoundCount: 0,
      missingPackCount: 0,
      errorCount: 0,
      successfulPriceCount: 0, // Backward compatibility alias = pricedCount
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

  cancel(reason = 'Manually stopped by administrator') {
    this.isCancelled = true;
    this.cancellationReason = reason;
    console.warn(`[${this.supplierName}] Cancellation requested: ${reason}`);
  }

  async delay(ms = 500) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async loadProductsFromCsv(filePath) {
    const results = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          const normalized = {};
          for (const key of Object.keys(data)) {
            const normKey = key.trim().toLowerCase().replace(/\s+/g, '_');
            normalized[normKey] = data[key];
          }
          if (!normalized.barcode && normalized.ean) normalized.barcode = normalized.ean;
          results.push(normalized);
        })
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
    if (this.isFinalized) return;
    this.isFinalized = true;
    try {
      const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);

      // Full metrics payload
      const updatePayload = {
        status,
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        attempted_count: this.stats.attemptedCount,
        matched_count: this.stats.matchedCount,
        priced_count: this.stats.pricedCount,
        missing_price_count: this.stats.missingPriceCount,
        in_stock_count: this.stats.inStockCount,
        out_of_stock_count: this.stats.outOfStockCount,
        unknown_stock_count: this.stats.unknownStockCount,
        ambiguous_count: this.stats.ambiguousCount,
        rejected_count: this.stats.rejectedCount,
        not_found_count: this.stats.notFoundCount,
        missing_pack_count: this.stats.missingPackCount,
        error_count: this.stats.errorCount,
        successful_price_count: this.stats.successfulPriceCount, // Backward compatibility
        log: logMessage,
      };

      const { error } = await supabase
        .from('scraper_runs')
        .update(updatePayload)
        .eq('id', this.runId);

      if (error) {
        console.error(`[${this.supplierName}] finalizeRun update error:`, error.message);
        // Fallback for pre-migration schema: update only existing columns
        await supabase
          .from('scraper_runs')
          .update({
            status,
            completed_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            attempted_count: this.stats.attemptedCount,
            successful_price_count: this.stats.successfulPriceCount,
            error_count: this.stats.errorCount,
            log: logMessage,
          })
          .eq('id', this.runId);
      }
    } catch (err) {
      console.error(`Failed to update scraper_runs for ${this.runId}:`, err.message);
    } finally {
      runLocks[this.supplierName] = false;
      await this.close().catch(() => { });
    }
  }

  async logSearchResult(logData) {
    // FIX 1: Return the inserted log row ID so the caller can backfill raw_product_id
    // on the winning success log entry after the raw_products upsert completes.
    try {
      let { data, error } = await supabase
        .from('product_search_logs')
        .insert(logData)
        .select('id')
        .single();
      if (error && error.message.includes('schema cache')) {
        const fallbackLog = { ...logData };
        delete fallbackLog.selected_candidate_code;
        delete fallbackLog.selected_candidate_url;
        const res = await supabase
          .from('product_search_logs')
          .insert(fallbackLog)
          .select('id')
          .single();
        data = res.data;
        error = res.error;
      }
      if (error) {
        console.error(`[${this.supplierName}] Failed to insert search log:`, error.message);
        return null;
      }
      return data?.id ?? null;
    } catch (err) {
      console.error(`[${this.supplierName}] Exception inserting search log:`, err.message);
      return null;
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
    if (!candidates || candidates.length === 0) {
      return { result_status: 'not_found', validation_score: 0, validation_reason: 'No candidates found.' };
    }

    let bestCandidate = null;
    let highestScore = -1;
    let isTie = false;
    let topCandidates = [];

    for (const candidate of candidates) {
      const evaluation = this.evaluateCandidate(csvProduct, candidate, strategy);

      if (evaluation.validation_score > highestScore) {
        highestScore = evaluation.validation_score;
        bestCandidate = { ...candidate, ...evaluation };
        topCandidates = [bestCandidate];
        isTie = false;
      } else if (evaluation.validation_score === highestScore && highestScore > 0) {
        isTie = true;
        topCandidates.push({ ...candidate, ...evaluation });
      }
    }

    // Classification Rules:
    // 1. Explicit metadata conflict (score === 0) -> REJECTED
    // 2. Default un-matched candidates (score <= 50 with no explicit metadata match) -> NOT_FOUND
    // 3. Plausible candidate with explicit metadata match (score >= 70) -> SUCCESS or AMBIGUOUS (if tied)
    if (!bestCandidate || (highestScore <= 50 && bestCandidate.result_status !== 'rejected')) {
      return { result_status: 'not_found', validation_score: 0, validation_reason: 'Candidates returned but none matched product metadata.' };
    }

    if (isTie) {
      const exactMatch = topCandidates.find(c =>
        c.rawTitle && (
          c.rawTitle.toLowerCase() === csvProduct.product_name.toLowerCase() ||
          ProductMetadataParser.titlesMatchAfterSuffixStrip(csvProduct.product_name, c.rawTitle) ||
          ProductMetadataParser.normalizeCoreTitle(csvProduct.product_name) === ProductMetadataParser.normalizeCoreTitle(c.rawTitle)
        )
      );
      if (exactMatch) {
        return exactMatch;
      }
      return {
        result_status: 'ambiguous',
        validation_score: highestScore,
        validation_reason: 'Multiple candidates tied with the highest valid score.'
      };
    }

    return bestCandidate;
  }

  evaluateCandidate(csvProduct, candidate, strategy) {
    // PHASE 3: Strict barcode vs product code separation
    let candidateBarcode = null;
    let candidateProductCode = candidate.supplierProductId || candidate.rawProductCode || null;

    if (candidate.rawBarcode && String(candidate.rawBarcode).replace(/\D/g, '').length >= 8) {
      candidateBarcode = ProductMetadataParser.normalizeBarcode(candidate.rawBarcode);
    }

    const csvBarcode = ProductMetadataParser.normalizeBarcode(csvProduct.barcode);

    // 1. Barcode check
    if (csvBarcode && candidateBarcode) {
      if (csvBarcode === candidateBarcode) {
        return { result_status: 'success', validation_score: 100, validation_reason: 'Exact normalized barcode match.', matched_fields: 'barcode', rawProductCode: candidateProductCode, rawBarcode: candidateBarcode };
      } else {
        return { result_status: 'rejected', validation_score: 0, validation_reason: `Conflicting barcode: Expected ${csvBarcode}, got ${candidateBarcode}.`, conflicting_fields: 'barcode' };
      }
    }

    // 2. Metadata extraction
    const csvName = csvProduct.product_name;
    const candName = candidate.rawTitle || '';

    const csvBrand = ProductMetadataParser.extractBrand(csvName);
    const candBrand = ProductMetadataParser.extractBrand(candName);

    const csvVol = ProductMetadataParser.extractVolume(csvName);
    const candVol = ProductMetadataParser.extractVolume(candName) || ProductMetadataParser.extractVolume(candidate.rawPackInfo);

    const csvWeight = ProductMetadataParser.extractWeight(csvName);
    const candWeight = ProductMetadataParser.extractWeight(candName) || ProductMetadataParser.extractWeight(candidate.rawPackInfo);

    const csvPack = ProductMetadataParser.extractPackSize(csvName);
    const candPack = ProductMetadataParser.extractPackSize(candName) || ProductMetadataParser.extractPackSize(candidate.rawPackInfo);

    const csvQty = ProductMetadataParser.extractQuantity(csvName);
    const candQty = ProductMetadataParser.extractQuantity(candName) || ProductMetadataParser.extractQuantity(candidate.rawPackInfo);

    const csvVar = ProductMetadataParser.extractVariant(csvName);
    const candVar = ProductMetadataParser.extractVariant(candName);

    const csvPM = ProductMetadataParser.extractPriceMark(csvName);
    const candPM = ProductMetadataParser.extractPriceMark(candName);

    const conflicts = [];
    const matched = [];

    // HARD CONFLICT 1: Brand mismatch
    if (csvBrand && candBrand && csvBrand !== candBrand) conflicts.push('brand');

    // HARD CONFLICT 2: Volume mismatch
    if (csvVol && candVol && csvVol !== candVol) conflicts.push('volume');

    // HARD CONFLICT 3: Weight mismatch
    if (csvWeight && candWeight && csvWeight !== candWeight) conflicts.push('weight');

    // HARD CONFLICT 4: Pack size / Quantity mismatch (Single item mapped to multipack)
    if (csvQty && candQty && csvQty !== candQty && !conflicts.includes('pack')) conflicts.push('pack');
    if (candQty && candQty > 1 && (!csvQty || csvQty !== candQty) && (candName.toLowerCase().includes('pack') || candName.toLowerCase().includes('pk') || (candidate.rawPackInfo && candidate.rawPackInfo.toLowerCase().includes('pack')))) {
      if (!conflicts.includes('pack')) conflicts.push('pack');
    }

    // HARD CONFLICT 5: Variant / Flavour mismatch
    if (csvVar && candVar && csvVar !== candVar) conflicts.push('variant');
    if (!csvVar && candVar && ['zero', 'diet', 'cherry', 'mango', 'tropical', 'strawberry', 'banana', 'peach', 'lime'].includes(candVar)) {
      if (!conflicts.includes('variant')) conflicts.push('variant');
    }

    // HARD CONFLICT 6: PMP / Price Mark mismatch
    if (csvPM && candPM && Math.abs(parseFloat(csvPM) - parseFloat(candPM)) > 0.05) {
      conflicts.push('price_mark');
    }

    if (conflicts.length > 0) {
      return {
        result_status: 'rejected',
        validation_score: 0,
        validation_reason: `Strict metadata conflicts detected: ${conflicts.join(', ')}.`,
        conflicting_fields: conflicts.join(',')
      };
    }

    // Match detection (Only explicit matches count)
    if (csvBrand && candBrand && csvBrand === candBrand) matched.push('brand');
    if (csvVol && candVol && csvVol === candVol) matched.push('volume');
    if (csvWeight && candWeight && csvWeight === candWeight) matched.push('weight');
    if ((csvPack && candPack && csvPack === candPack) || (csvQty && candQty && csvQty === candQty)) matched.push('pack');
    if (csvVar && candVar && csvVar === candVar) matched.push('variant');

    const brandMatched = matched.includes('brand');
    const volOrWeightMatched = matched.includes('volume') || matched.includes('weight');
    const packMatched = matched.includes('pack');
    const variantMatched = matched.includes('variant');
    const coreTitleMatched = (
      ProductMetadataParser.normalizeCoreTitle(csvName) === ProductMetadataParser.normalizeCoreTitle(candName) ||
      ProductMetadataParser.titlesMatchAfterSuffixStrip(csvName, candName) ||
      (csvBrand && candBrand && csvBrand === candBrand && (csvVol || csvWeight) && ProductMetadataParser.cleanName(csvName).toLowerCase().includes(ProductMetadataParser.cleanName(candName).toLowerCase()))
    );

    let score = 50; // Default if nothing explicitly matches

    // Requirement 4: Safe SUCCESS Scoring Combinations
    if ((brandMatched || coreTitleMatched) && (volOrWeightMatched || coreTitleMatched) && (coreTitleMatched || variantMatched || packMatched) && conflicts.length === 0) {
      score = 90; // Safe SUCCESS threshold
    } else if (brandMatched && (volOrWeightMatched || packMatched)) {
      score = 80; // Ambiguous
    } else if (brandMatched) {
      score = 70; // Ambiguous
    } else if (coreTitleMatched) {
      score = 85; // Strong ambiguous
    } else if (volOrWeightMatched || packMatched) {
      score = 60; // Weak ambiguous
    }

    // FIX 2: Revised barcode strategy boost
    if (strategy === 'barcode' || strategy === 'normalized_barcode') {
      const candidateIsVerifiableEAN = candidateBarcode !== null &&
        candidateBarcode !== undefined &&
        candidateBarcode.length >= 8;

      if (candidateIsVerifiableEAN && csvBarcode === candidateBarcode) {
        score = 100;
      } else if (brandMatched && conflicts.length === 0 && candidateIsVerifiableEAN) {
        score = 90;
      } else if (!candidateIsVerifiableEAN) {
        if (csvBrand && !candBrand) {
          return {
            result_status: 'rejected',
            validation_score: 0,
            validation_reason: `Barcode search returned unverifiable candidate (barcode "${candidateBarcode}", ${candidateBarcode ? candidateBarcode.length : 0} digits). Source brand "${csvBrand}" has no match in candidate title — likely an unrelated fallback or promoted product on a no-results page.`,
            conflicting_fields: 'brand',
          };
        }
      } else if (score >= 90) {
        score = Math.min(99, score + 5);
      } else {
        score = Math.min(89, score + 15);
      }
      matched.push('supplier_barcode_search');
    }

    let status = 'not_found';
    if (score >= 90) status = 'success';
    else if (score >= 60) status = 'ambiguous';

    return {
      result_status: status,
      validation_score: score,
      validation_reason: `Evaluated with score ${score}.`,
      matched_fields: matched.join(',')
    };
  }

  async processProduct(rawCsvProduct, page) {
    if (this.isCancelled) return;
    this.stats.attemptedCount++;
    const now = new Date().toISOString();

    const product = await this.metadataLayer.enrichProduct(rawCsvProduct);

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
    let bestNonSuccessEvaluated = null;

    console.log(`\n[${this.supplierName}] Processing: ${product.product_name} (${product.barcode})`);

    for (const strategy of strategies) {
      if (this.isCancelled) return;
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

        // AMBIGUOUS AI RESOLUTION HOOK: If 2+ viable candidates remain and status is ambiguous, invoke CandidateResolverService
        if (evaluated.result_status === 'ambiguous' && candidates.length >= 2) {
          const aiResolution = await this.candidateResolver.resolveAmbiguous(product, candidates);
          if (aiResolution.finalStatus === 'VERIFIED_EQUIVALENT' && aiResolution.recommendedCandidate) {
            evaluated = {
              ...aiResolution.recommendedCandidate,
              result_status: 'success',
              validation_score: 95,
              validation_reason: `AI Resolved candidate "${aiResolution.recommendedCandidate.rawTitle}": ${aiResolution.reasoningSummary}`,
              matched_fields: 'ai_resolved_equivalent'
            };
          }
        }
      }

      console.log(`[${this.supplierName}]      Result: ${evaluated.result_status.toUpperCase()} (Score: ${evaluated.validation_score}) - ${evaluated.validation_reason}`);

      // Track non-success attempts to classify final un-matched outcome (ambiguous > rejected > not_found)
      if (evaluated.result_status !== 'success') {
        if (!bestNonSuccessEvaluated ||
          (evaluated.result_status === 'ambiguous' && bestNonSuccessEvaluated.result_status !== 'ambiguous') ||
          (evaluated.result_status === 'rejected' && bestNonSuccessEvaluated.result_status === 'not_found')) {
          bestNonSuccessEvaluated = evaluated;
        }
      }

      // Attempt-level robust logging
      const insertedLogId = await this.logSearchResult({
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
        selected_candidate_code: evaluated.rawProductCode || evaluated.rawBarcode || null,
        selected_candidate_url: evaluated.rawUrl || null,
        candidate_count: candidates.length,
        search_duration_ms: searchDuration,
        error_message: errorMessage,
      });

      if (evaluated.result_status === 'success') {
        finalResult = { ...evaluated, _logId: insertedLogId };
        break; // Stop searching! We found it.
      }

      attemptNumber++;
      await this.delay(1000); // polite pause between attempts
    }

    // SEARCH RECOVERY HOOK: If normal search strategies produced zero results / not_found, invoke SearchRecoveryService
    if (!finalResult && bestNonSuccessEvaluated?.result_status !== 'ambiguous' && bestNonSuccessEvaluated?.result_status !== 'rejected') {
      const attemptedTerms = strategies.map(s => s.term);
      const searchFn = async (queryText) => {
        attemptNumber++;
        const recStart = Date.now();
        let recCandidates = [];
        let recError = null;

        try {
          recCandidates = await this.executeSearch(page, queryText, 'ai_search_recovery');
          if (!Array.isArray(recCandidates)) recCandidates = recCandidates ? [recCandidates] : [];
        } catch (e) {
          recError = e.message;
        }

        const recDuration = Date.now() - recStart;

        await this.logSearchResult({
          scraper_run_id: this.runId,
          supplier_id: this.supplierRow.id,
          source_catalogue_key: product.barcode || product.product_name,
          barcode: product.barcode,
          original_product_name: product.product_name,
          attempt_number: attemptNumber,
          search_strategy: 'ai_search_recovery',
          searched_term: queryText,
          result_status: recError ? 'error' : (recCandidates.length > 0 ? 'ambiguous' : 'not_found'),
          validation_score: recCandidates.length > 0 ? 60 : 0,
          validation_reason: recError || (recCandidates.length > 0 ? 'Recovery query returned candidates.' : 'Recovery query returned zero results.'),
          candidate_count: recCandidates.length,
          search_duration_ms: recDuration,
          error_message: recError
        });

        return recCandidates;
      };

      const recoveryRes = await this.searchRecovery.recoverNotFoundItem(product, this.supplierName, {
        previousAttempts: attemptedTerms,
        searchFn
      });

      if (recoveryRes.finalStatus === 'VERIFIED_EQUIVALENT' && recoveryRes.recommendedCandidate) {
        finalResult = {
          ...recoveryRes.recommendedCandidate,
          result_status: 'success',
          validation_score: 95,
          validation_reason: recoveryRes.reasoningSummary
        };
      } else if (recoveryRes.finalStatus === 'NEEDS_REVIEW') {
        bestNonSuccessEvaluated = {
          result_status: 'ambiguous',
          validation_score: 70,
          validation_reason: recoveryRes.reasoningSummary
        };
      } else {
        bestNonSuccessEvaluated = {
          result_status: 'not_found',
          validation_score: 0,
          validation_reason: recoveryRes.reasoningSummary || 'SEARCH_STRATEGY_EXHAUSTED'
        };
      }
    }

    if (finalResult) {
      try {
        const rawTitle = finalResult.rawTitle || product.product_name;
        const rawPackInfo = ProductMetadataParser.sanitizePackInfo(finalResult.rawPackInfo);

        const rawProductCode = finalResult.rawProductCode || null;
        const rawUrl = finalResult.rawUrl || null;

        // IMMUTABLE SUPPLIER-PRODUCT IDENTITY
        // A raw_product row represents a SPECIFIC supplier listing, not just a barcode+supplier combo.
        // If two supplier listings for the same catalogue barcode have different supplier product codes,
        // they MUST be stored as separate rows — otherwise snapshot history is contaminated.
        //
        // Priority:
        //   1. supplier_id + raw_product_code (immutable supplier listing identity)
        //      → used when the scraper has identified a specific supplier product code
        //   2. supplier_id + raw_barcode (fallback when no supplier product code exists)
        //      → only used for suppliers that don't expose product codes
        //
        // NEVER overwrite raw_product_code with a different code on an existing row.
        // A different supplier code = a different supplier listing = a different raw_product row.
        let rawProduct, rawError;

        if (rawProductCode) {
          // PATH A: Use supplier_id + raw_product_code as the immutable identity key.
          // First try to find an existing row with this exact code.
          const { data: existing } = await supabase
            .from('raw_products')
            .select('id')
            .eq('supplier_id', this.supplierRow.id)
            .eq('raw_product_code', rawProductCode)
            .maybeSingle();

          if (existing) {
            // Update the existing supplier-listing row (mutable fields only: title, pack, url, scraped_at).
            // raw_product_code is the stable key — never overwrite it here.
            const { data: updated, error: updateErr } = await supabase
              .from('raw_products')
              .update({
                raw_title: rawTitle,
                raw_barcode: product.barcode,
                raw_url: rawUrl,
                raw_pack_info: rawPackInfo,
                scraped_at: now,
              })
              .eq('id', existing.id)
              .select()
              .single();
            rawProduct = updated;
            rawError = updateErr;
          } else {
            // No existing row for this supplier code — insert a new immutable row.
            const { data: inserted, error: insertErr } = await supabase
              .from('raw_products')
              .insert({
                supplier_id: this.supplierRow.id,
                raw_title: rawTitle,
                raw_barcode: product.barcode,
                raw_product_code: rawProductCode,
                raw_url: rawUrl,
                raw_pack_info: rawPackInfo,
                scraped_at: now,
              })
              .select()
              .single();
            rawProduct = inserted;
            rawError = insertErr;
          }
        } else {
          // PATH B: No supplier product code — fall back to supplier_id + raw_barcode upsert.
          // This is the legacy path for suppliers that don't expose product codes.
          // Accept the mutation risk here since we have no better key.
          const { data: upserted, error: upsertErr } = await supabase
            .from('raw_products')
            .upsert(
              {
                supplier_id: this.supplierRow.id,
                raw_title: rawTitle,
                raw_barcode: product.barcode,
                raw_url: rawUrl,
                raw_pack_info: rawPackInfo,
                scraped_at: now,
              },
              { onConflict: 'supplier_id,raw_barcode' }
            )
            .select()
            .single();
          rawProduct = upserted;
          rawError = upsertErr;
        }

        if (rawError) throw new Error(`raw_products upsert failed: ${rawError.message}`);

        // Extract case quantity and calculate normalized unit cost
        const caseQuantity = ProductMetadataParser.extractQuantity(rawPackInfo) || ProductMetadataParser.extractQuantity(rawTitle) || 1;
        const unitCost = (finalResult.price && caseQuantity > 0) ? parseFloat((finalResult.price / caseQuantity).toFixed(4)) : null;

        // DATA INTEGRITY GUARD: Check if extracted price is valid
        // Reject cases where case_price <= 3.00 when caseQuantity > 1 (e.g. £1.50 or £1.99 extracted from PMP badge for a case of 24)
        const isPriceInvalid = !finalResult.price || finalResult.price <= 0 || (caseQuantity > 1 && finalResult.price <= 3.00);

        if (isPriceInvalid) {
          console.warn(`[${this.supplierName}]   ⚠ PRICE_VALIDATION_FAILED: Extracted price £${finalResult.price} is invalid for ${rawTitle} (Case qty: ${caseQuantity}). Snapshot skipped.`);
          if (finalResult._logId) {
            await supabase.from('product_search_logs').update({
              result_status: 'rejected',
              validation_reason: `PRICE_VALIDATION_FAILED: £${finalResult.price} invalid for case qty ${caseQuantity}`
            }).eq('id', finalResult._logId);
          }
        } else {
          const { data: snapData, error: snapError } = await supabase
            .from('price_snapshots')
            .insert({
              canonical_product_id: null,
              supplier_id: this.supplierRow.id,
              raw_product_id: rawProduct.id,
              case_price: finalResult.price,
              unit_cost: unitCost,
              in_stock: finalResult.inStock,
              promotion_flag: finalResult.promotionFlag || false,
              snapshot_at: now,
            })
            .select('id')
            .single();

          if (snapError) throw new Error(`price_snapshots insert failed: ${snapError.message}`);

          console.log(`[${this.supplierName}]   ✓ DB: raw_products.id=${rawProduct.id} → price_snapshots.id=${snapData.id} (case: £${finalResult.price}, unit: £${unitCost})`);
        }

        if (finalResult._logId) {
          const { error: logUpdateError } = await supabase
            .from('product_search_logs')
            .update({ raw_product_id: rawProduct.id })
            .eq('id', finalResult._logId);
          if (logUpdateError) {
            console.warn(`[${this.supplierName}]   ⚠ Could not update product_search_logs.raw_product_id:`, logUpdateError.message);
          }
        }

        // Product-level metrics tracking for SUCCESS match
        this.stats.matchedCount++;

        if (finalResult.price !== null && finalResult.price > 0) {
          this.stats.pricedCount++;
          this.stats.successfulPriceCount++; // Backward compatibility
        } else {
          this.stats.missingPriceCount++;
        }

        if (finalResult.inStock === true) {
          this.stats.inStockCount++;
        } else if (finalResult.inStock === false) {
          this.stats.outOfStockCount++;
        } else {
          this.stats.unknownStockCount++;
        }

        if (!rawPackInfo) {
          this.stats.missingPackCount++;
        }
      } catch (err) {
        this.stats.errorCount++;
        console.error(`[${this.supplierName}] ✗ Final DB Write Error:`, err.message);
      }
    } else {
      // Product-level metrics tracking for UNMATCHED product
      if (bestNonSuccessEvaluated?.result_status === 'ambiguous') {
        this.stats.ambiguousCount++;
      } else if (bestNonSuccessEvaluated?.result_status === 'rejected') {
        this.stats.rejectedCount++;
      } else {
        this.stats.notFoundCount++;
      }
      console.log(`[${this.supplierName}] ✗ Product completely not found after all attempts.`);
    }
  }

  // To be overridden by child classes
  async executeSearch(pg, term, strategy) {
    throw new Error('executeSearch must be implemented by subclass.');
  }

  async login() {
    throw new Error('login must be implemented by subclass.');
  }

  async loadProducts(input) {
    if (Array.isArray(input)) {
      return input;
    }
    const CatalogueService = require('../services/CatalogueService');
    const cs = new CatalogueService();
    return cs.loadActiveCatalogue(input);
  }

  async run(input = null) {
    try {
      await this.initRun();
      console.log(`\n=== Started ${this.supplierName} Scraper (Run ID: ${this.runId}) ===`);

      const products = await this.loadProducts(input);
      console.log(`Loaded ${products.length} products.`);

      const page = await this.login();
      if (!page) {
        throw new Error('Login failed.');
      }

      for (const product of products) {
        if (this.isCancelled) {
          console.warn(`[${this.supplierName}] Scraper run cancelled. Exiting item loop.`);
          break;
        }
        await this.delay();
        await this.processProduct(product, page);
      }

      if (this.isCancelled) {
        console.log(`\n=== Cancelled ${this.supplierName} Scraper (Run ID: ${this.runId}) ===`);
        await this.finalizeRun('failed', this.cancellationReason || 'Cancelled: Manually stopped by administrator');
        return this.stats;
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
