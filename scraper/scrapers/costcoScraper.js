const { chromium } = require('playwright');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { BaseScraper } = require('./BaseScraper');

const STORAGE_STATE_PATH = path.join(__dirname, 'costco_state.json');
const COSTCO_API_BASE = 'https://www.costco.co.uk/rest/v2/uk';

/**
 * CostcoScraper
 *
 * Costco UK uses SAP Commerce (Spartacus Angular frontend) with a public REST OCC API.
 * The API endpoint is:
 *   GET /rest/v2/uk/products/search?fields=FULL&query={term}&pageSize=48&searchOption=uk-search-all&lang=en_GB&curr=GBP
 *
 * This API returns structured JSON with full product data (price, name, stock, promotions etc.)
 * WITHOUT requiring authentication. We use direct HTTPS calls instead of browser DOM scraping,
 * which is faster, more reliable, and unaffected by Angular rendering delays.
 *
 * Playwright is kept ONLY for the optional authenticated login session (member pricing may differ).
 * If login fails, we fall through to public API pricing seamlessly.
 */
class CostcoScraper extends BaseScraper {
  constructor() {
    super('costco');
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionCookies = null; // Auth cookies for API calls if logged in

    this.capabilities = {
      supportsBarcodeSearch: false,  // Costco UK API search is name-based only
      supportsNameSearch: true,
      supportsDirectProductRedirect: false,
      supportsMultipleResults: true,
      supportsStockStatus: true,
      supportsPromotionBadges: true,
      exposesBarcodesInDOM: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Costco-specific candidate evaluation
  //
  // Costco is a warehouse retailer that sells products in DIFFERENT bulk pack counts
  // than normal wholesale. For example:
  //   CSV (wholesale):  "Coca Cola 24x330ml"
  //   Costco sells:     "Coca Cola 30x330ml"
  //
  // The BASE validator treats pack count mismatch as a hard conflict (score=0).
  // We override this to: if brand AND volume unit match, it's the same product
  // regardless of how many units are in the Costco pack.
  //
  // Pack count mismatch is EXPECTED and should NOT be a rejection criterion.
  // ─────────────────────────────────────────────────────────────────────────────
  evaluateCandidate(csvProduct, candidate, strategy) {
    const ProductMetadataParser = require('../utils/ProductMetadataParser');

    const csvName = (csvProduct.product_name || '').toLowerCase();
    const candName = (candidate.rawTitle || '').toLowerCase();

    let csvBrand = csvProduct.brand ? csvProduct.brand.toLowerCase() : ProductMetadataParser.extractBrand(csvName);
    let candBrand = ProductMetadataParser.extractBrand(candName);

    // Normalize brand aliases (e.g., 'kit kat' vs 'kitkat')
    if (csvBrand === 'kit kat' || csvBrand === 'kitkat') csvBrand = 'kitkat';
    if (candBrand === 'kit kat' || candBrand === 'kitkat') candBrand = 'kitkat';

    const csvVol = csvProduct.volume ? csvProduct.volume.toLowerCase() : ProductMetadataParser.extractVolume(csvName);
    const candVol = ProductMetadataParser.extractVolume(candName);

    const csvWeight = csvProduct.weight ? csvProduct.weight.toLowerCase() : ProductMetadataParser.extractWeight(csvName);
    const candWeight = ProductMetadataParser.extractWeight(candName);

    const conflicts = [];
    const matched = [];

    // 1. Brand conflict — must be explicit mismatch to reject
    if (csvBrand && candBrand && csvBrand !== candBrand) {
      // Check if candidate title contains the CSV brand anywhere as a fallback
      if (!candName.includes(csvBrand)) {
        conflicts.push('brand');
      }
    }

    // 2. Volume/weight unit conflict (e.g. 330ml vs 500ml = different product)
    if (csvVol && candVol && csvVol !== candVol) conflicts.push('volume');
    if (csvWeight && candWeight && csvWeight !== candWeight) conflicts.push('weight');

    // 3. Variant conflict checking (e.g. Original vs Zero/Diet/Sugar Free/Flavours)
    const variants = [
      { key: 'zero', keywords: ['zero', 'no sugar', 'zero sugar'] },
      { key: 'diet', keywords: ['diet', 'light', 'lite'] },
      { key: 'max', keywords: ['max'] },
      { key: 'sugar free', keywords: ['sugar free', 'sugarfree'] },
      { key: 'cherry', keywords: ['cherry'] },
      { key: 'vanilla', keywords: ['vanilla'] },
      { key: 'original', keywords: ['original', 'regular'] },
    ];

    for (const v of variants) {
      const csvHasVariant = v.keywords.some(k => csvName.includes(k));
      const candHasVariant = v.keywords.some(k => candName.includes(k));

      // If CSV explicitly specifies a key variant (like zero, diet, max, cherry) and candidate doesn't have it, conflict
      if (['zero', 'diet', 'max', 'cherry', 'sugar free'].includes(v.key)) {
        if (csvHasVariant && !candHasVariant) conflicts.push(`variant_${v.key}`);
        if (!csvHasVariant && candHasVariant && (csvName.includes('original') || csvName.includes('regular'))) {
          conflicts.push(`variant_${v.key}`);
        }
      }
    }

    // 4. Product Category / Item Type conflict checking (prevents false positives)
    const categoryPairs = [
      ['crisps', 'biscuits'],
      ['crisps', 'biscuit'],
      ['crisps', 'cookies'],
      ['energy', 'monitor'],
      ['drink', 'monitor'],
      ['beverage', 'monitor'],
      ['energy', 'cage'],
      ['drink', 'cage'],
      ['drink', 'maker'],
      ['beverage', 'maker'],
      ['drink', 'appliance'],
      ['ice', 'maker'],
      ['cubes', 'maker'],
      ['ice', 'machine'],
      ['cubes', 'machine'],
      ['water', 'underfloor'],
      ['water', 'thermostat'],
      ['water', 'heating'],
      ['water', 'filter'],
      ['coffee', 'tea'],
      ['beans', 'soup'],
      ['water', 'juice'],
      ['water', 'biscuit'],
      ['chocolate', 'biscuit'],
      ['fruit', 'electronics'],
      ['drink', 'dried'],
      ['juice', 'dried'],
      ['mango', 'dried'],
    ];

    for (const [cat1, cat2] of categoryPairs) {
      if (csvName.includes(cat1) && candName.includes(cat2) && !csvName.includes(cat2)) {
        conflicts.push(`category_${cat1}_vs_${cat2}`);
      }
      if (csvName.includes(cat2) && candName.includes(cat1) && !csvName.includes(cat1)) {
        conflicts.push(`category_${cat2}_vs_${cat1}`);
      }
    }


    if (conflicts.length > 0) {
      return {
        result_status: 'rejected',
        validation_score: 0,
        validation_reason: `Costco metadata conflicts: ${conflicts.join(', ')}`,
        conflicting_fields: conflicts.join(','),
      };
    }

    // Match scoring
    if (csvBrand && (candBrand === csvBrand || candName.includes(csvBrand))) matched.push('brand');
    if (csvVol && candVol && csvVol === candVol) matched.push('volume');
    if (csvWeight && candWeight && csvWeight === candWeight) matched.push('weight');

    const brandMatched = matched.includes('brand');
    const unitMatched = matched.includes('volume') || matched.includes('weight');

    let score = 45;

    if (brandMatched && unitMatched) {
      // Brand + unit volume/weight match = we have the right product regardless of pack count
      score = 95; // UNAMBIGUOUS SUCCESS
    } else if (brandMatched) {
      score = 70; // Brand only — ambiguous
    } else if (unitMatched) {
      score = 55; // Volume only — weak
    } else if (ProductMetadataParser.normalizeText(csvName) === ProductMetadataParser.normalizeText(candName)) {
      score = 85; // Exact name match
    }

    let status = 'rejected';
    if (score >= 90) status = 'success';
    else if (score >= 60) status = 'ambiguous';

    return {
      result_status: status,
      validation_score: score,
      validation_reason: `Costco evaluation score ${score}. Matched: [${matched.join(', ')}]`,
      matched_fields: matched.join(','),
      ...candidate,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX 1 — Search Result Classification Override
  // If all returned candidates evaluate to rejected (or score < 60), return NOT_FOUND.
  // Only return AMBIGUOUS when valid candidate options exist.
  // ─────────────────────────────────────────────────────────────────────────────
  validateCandidates(csvProduct, candidates, strategy) {
    if (!candidates || candidates.length === 0) {
      return { result_status: 'not_found', validation_score: 0, validation_reason: 'No candidates found.' };
    }

    let bestCandidate = null;
    let highestScore = -1;
    let validCount = 0;

    for (const candidate of candidates) {
      const evaluation = this.evaluateCandidate(csvProduct, candidate, strategy);

      if (evaluation.result_status !== 'rejected' && evaluation.validation_score >= 60) {
        validCount++;
        if (evaluation.validation_score > highestScore) {
          highestScore = evaluation.validation_score;
          bestCandidate = { ...candidate, ...evaluation };
        }
      }
    }

    // FIX 1 Rule: If all candidates are rejected or no candidate achieves valid score >= 60, return NOT_FOUND.
    if (!bestCandidate || validCount === 0) {
      return {
        result_status: 'not_found',
        validation_score: 0,
        validation_reason: 'Candidates returned but none matched product metadata / all candidates rejected.',
      };
    }

    if (highestScore >= 90) {
      return bestCandidate;
    }

    if (validCount >= 2) {
      return {
        result_status: 'ambiguous',
        validation_score: highestScore,
        validation_reason: 'Multiple valid candidates found with ambiguous confidence scores.',
      };
    }

    return bestCandidate;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Direct API call to Costco UK REST endpoint
  // ─────────────────────────────────────────────────────────────────────────────
  async callCostcoApi(searchTerm) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        fields: 'FULL',
        query: searchTerm,
        pageSize: '48',
        searchOption: 'uk-search-all',
        lang: 'en_GB',
        curr: 'GBP',
      });

      const url = `${COSTCO_API_BASE}/products/search?${params.toString()}`;
      
      const options = {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Referer': 'https://www.costco.co.uk/',
          'Origin': 'https://www.costco.co.uk',
          // If we have session cookies from login, include them
          ...(this.sessionCookies ? { 'Cookie': this.sessionCookies } : {}),
        },
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${e.message}. Raw: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(20000, () => {
        req.destroy();
        reject(new Error('API request timed out after 20s'));
      });
      req.end();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Map a raw API product object to our internal candidate format
  // ─────────────────────────────────────────────────────────────────────────────
  mapApiProductToCandidate(product) {
    // Product name
    const rawTitle = product.name || product.summary || null;

    // Price — use basePrice (case/total price)
    const price = product.basePrice?.value ?? null;

    // Unit price — may be in unitPrice or we can compute from basePrice / qty
    const unitPrice = product.unitPrice?.value ?? null;

    // Pack info — extract from name or packagingInfo field
    let rawPackInfo = product.packagingInfo || null;
    if (!rawPackInfo && rawTitle) {
      const packMatch = rawTitle.match(
        /\b(\d+\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cl|litre|ltr|oz|pint|pt)|\d+\s*(?:ml|l|g|kg|cl|litre|ltr|oz|pint|pt)|\d+\s*(?:pack|pk|can|cans|bottle|bottles))\b/i
      );
      if (packMatch) rawPackInfo = packMatch[0];
    }

    // Stock status
    const stockStatus = product.stock?.stockLevelStatus || '';
    const inStock = stockStatus !== 'outOfStock' && product.addableToCartFromListingPage !== false;

    // Promotion flag
    const promotionFlag = !!(
      (product.promotions && product.promotions.length > 0) ||
      product.as400Discount ||
      (product.potentialPromotions && product.potentialPromotions.length > 0)
    );

    // Product URL
    const productUrl = product.url ? `https://www.costco.co.uk${product.url}` : null;

    // Supplier product ID (Costco item code)
    const supplierProductId = product.code || null;

    return {
      rawTitle,
      rawPackInfo,
      price,
      unitPrice,
      inStock,
      promotionFlag,
      productUrl,
      supplierProductId,
      rawProductCode: supplierProductId,
      rawUrl: productUrl,
      rawBarcode: null, // Costco API does not expose EAN/barcodes
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cookie consent handler (used during login)
  // ─────────────────────────────────────────────────────────────────────────────
  async handleCookieConsent(pg) {
    try {
      const acceptBtn = pg.locator(
        '#onetrust-accept-btn-handler, button:has-text("Accept All Cookies"), button:has-text("Accept All")'
      );
      if (await acceptBtn.count() > 0) {
        await acceptBtn.first().click({ timeout: 5000 });
        await pg.waitForTimeout(1500);
        console.log('[Costco] Cookie consent accepted.');
      }
    } catch { /* Not present — continue silently */ }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Login via Playwright (optional — improves pricing quality if successful)
  // ─────────────────────────────────────────────────────────────────────────────
  async login() {
    const email = process.env.COSTCO_EMAIL;
    const password = process.env.COSTCO_PASSWORD;

    if (!email || !password || process.env.COSTCO_USE_BROWSER !== 'true') {
      console.log('[Costco] Using direct SAP OCC REST API search.');
      return {}; // Return empty object as a truthy "page" so run() doesn't abort
    }

    console.log('[Costco] Attempting authenticated login for member pricing...');

    const hasState = fs.existsSync(STORAGE_STATE_PATH);
    const headless = process.env.SCRAPER_HEADLESS === 'true';

    try {
      this.browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--lang=en-GB'],
      });

      const contextOptions = {
        locale: 'en-GB',
        timezoneId: 'Europe/London',
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      };
      if (hasState) contextOptions.storageState = STORAGE_STATE_PATH;

      this.context = await this.browser.newContext(contextOptions);
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
      });

      this.page = await this.context.newPage();

      // Navigate to homepage
      try {
        await this.page.goto('https://www.costco.co.uk/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      } catch (navErr) {
        console.warn('[Costco] Navigation warning (non-fatal):', navErr.message);
      }
      await this.page.waitForTimeout(3000);
      await this.handleCookieConsent(this.page);

      // Check if already logged in from saved state
      const signInCount = await this.page.locator('a[href*="/login"], a:has-text("Sign In")').count();
      const alreadyLoggedIn = signInCount === 0;

      if (!alreadyLoggedIn) {
        if (hasState) fs.unlinkSync(STORAGE_STATE_PATH);

        // Navigate to login
        try {
          await this.page.goto('https://www.costco.co.uk/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch {}
        await this.page.waitForTimeout(2000);

        if (this.page.url().includes('/login')) {
          await this.page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 10000 }).catch(() => {});
          await this.page.fill('input[name="username"], input[type="email"]', email).catch(() => {});
          await this.page.fill('input[name="password"], input[type="password"]', password).catch(() => {});
          await this.page.locator('button[type="submit"]').first().click({ timeout: 10000 }).catch(() => {});
          await this.page.waitForTimeout(5000);
        }
      }

      // Extract cookies for API calls
      const cookies = await this.context.cookies();
      this.sessionCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Save state for next run
      await this.context.storageState({ path: STORAGE_STATE_PATH }).catch(() => {});

      console.log('[Costco] ✓ Login phase complete. Proceeding with API calls.');

      // Return the page object so BaseScraper.run() is happy, but we won't use it for searching
      return this.page;
    } catch (err) {
      console.warn('[Costco] Login attempt failed (non-fatal):', err.message);
      console.warn('[Costco] Proceeding with public API pricing.');
      // Return truthy value so run() doesn't abort
      return this.page || {};
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // executeSearch — uses direct REST API, NOT browser DOM
  // ─────────────────────────────────────────────────────────────────────────────
  async executeSearch(pg, term, strategy) {
    try {
      console.log(`[Costco]   API search: "${term}"`);
      const apiResponse = await this.callCostcoApi(term);

      if (!apiResponse || !apiResponse.products || !Array.isArray(apiResponse.products)) {
        // Check for error response
        if (apiResponse.errors) {
          console.warn(`[Costco]   API error: ${JSON.stringify(apiResponse.errors)}`);
        }
        return [];
      }

      const total = apiResponse.pagination?.totalResults ?? apiResponse.products.length;
      console.log(`[Costco]   Found ${total} total results, mapping ${apiResponse.products.length} products.`);

      const candidates = apiResponse.products
        .map(p => this.mapApiProductToCandidate(p))
        .filter(c => c.rawTitle && c.price > 0);

      return candidates;
    } catch (err) {
      console.error(`[Costco] executeSearch failed for "${term}":`, err.message);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Browser teardown
  // ─────────────────────────────────────────────────────────────────────────────
  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}

module.exports = CostcoScraper;
