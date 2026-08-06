/**
 * BestwayScraper
 *
 * Integration type: HYBRID
 * - Playwright: handles OAuth2 login (auth.bestwaywholesale.co.uk) and account selection
 * - Unbxd REST API: product search (search.unbxd.io) — authenticated via depot cookie
 *
 * Authentication Flow:
 * - OAuth2 login at auth.bestwaywholesale.co.uk (FusionAuth)
 * - Post-login: /switch-account page — account number must be selected
 * - Depot number set via `unbxd_depot` cookie after account selection
 *
 * Search API:
 * - https://search.unbxd.io/{UNBXD_API_KEY}/prod-bestwaywholesale-co-uk7871603273203/search
 * - EAN barcode is embedded in product image URL filename
 * - Case price is NOT directly exposed — derived from rsp × (1 - minPOR/100)
 * - minPOR = minimum percentage of retail (margin %)
 * - rsp = recommended selling price (per unit)
 * - case_price = rsp × pack_count × (1 - minPOR/100)
 *
 * Env vars required:
 *   BESTWAY_USERNAME   - email address registered with Bestway
 *   BESTWAY_PASSWORD   - account password
 *   BESTWAY_BASE_URL   - base site URL (default: https://www.bestwaywholesale.co.uk)
 *   BESTWAY_ACCOUNT    - account number to select (e.g. 708444574). If not set, first is used.
 *   BESTWAY_DEPOT      - depot number for Unbxd stock filter (e.g. 208). Detected automatically.
 */

const { chromium } = require('playwright');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { BaseScraper } = require('./BaseScraper');

const STORAGE_STATE_PATH = path.join(__dirname, 'bestway_state.json');
const UNBXD_API_KEY      = '133aa25310a104431dfd47c6180fd7e2';
const UNBXD_SITE_KEY     = 'prod-bestwaywholesale-co-uk7871603273203';
const UNBXD_SEARCH_BASE  = `https://search.unbxd.io/${UNBXD_API_KEY}/${UNBXD_SITE_KEY}`;
const BASE_URL           = process.env.BESTWAY_BASE_URL || 'https://www.bestwaywholesale.co.uk';

class BestwayScraper extends BaseScraper {
  constructor() {
    super('bestway');

    this.browser       = null;
    this.context       = null;
    this.page          = null;
    this.sessionCookieHeader = null; // Raw cookie string for API calls
    this.depotNumber   = process.env.BESTWAY_DEPOT || null; // Will be detected from session

    this.capabilities = {
      supportsBarcodeSearch:          true,   // EAN barcode from image URL; we search by barcode string too
      supportsNameSearch:             true,
      supportsDirectProductRedirect:  false,  // Search always returns result set
      supportsMultipleResults:        true,
      supportsStockStatus:            true,   // depot_number_inStock_Y filter
      supportsPromotionBadges:        true,   // via title parsing and product detail
      exposesBarcodesInDOM:           false,  // EAN in image URL, not DOM text
      requiresBranchSelection:        false,
      requiresAccountSelection:       true,   // /switch-account after login
      supportsPagination:             true,
      supportsInfiniteScroll:         false,
      integrationType:                'api',  // Unbxd REST API for search
    };
  }

  // ─── Override evaluateCandidate for wholesale pack behaviour ─────────────────
  // Bestway is a cash & carry. Products are sold by case. Pack counts should match
  // or at least not conflict. Variant conflicts must still be strict.
  evaluateCandidate(csvProduct, candidate, strategy) {
    const ProductMetadataParser = require('../utils/ProductMetadataParser');

    const csvName  = (csvProduct.product_name || '').toLowerCase();
    const candName = (candidate.rawTitle || '').toLowerCase();

    // ── Barcode check first ──────────────────────────────────────────────────
    const csvBarcode  = ProductMetadataParser.normalizeBarcode(csvProduct.barcode);
    const candBarcode = ProductMetadataParser.normalizeBarcode(candidate.rawBarcode);

    if (csvBarcode && candBarcode) {
      if (csvBarcode === candBarcode) {
        return {
          result_status: 'success',
          validation_score: 100,
          validation_reason: 'Exact EAN barcode match from image URL.',
          matched_fields: 'barcode',
          ...candidate,
        };
      } else if (candBarcode.length > 7) {
        return {
          result_status: 'rejected',
          validation_score: 0,
          validation_reason: `Barcode conflict: expected ${csvBarcode}, got ${candBarcode}.`,
          conflicting_fields: 'barcode',
          ...candidate,
        };
      }
    }

    // ── Metadata extraction ──────────────────────────────────────────────────
    const csvBrand  = ProductMetadataParser.extractBrand(csvName);
    const candBrand = ProductMetadataParser.extractBrand(candName);
    const csvVol    = ProductMetadataParser.extractVolume(csvName);
    const candVol   = ProductMetadataParser.extractVolume(candName);
    const csvWeight = ProductMetadataParser.extractWeight(csvName);
    const candWeight= ProductMetadataParser.extractWeight(candName);
    const csvPack   = ProductMetadataParser.extractPackSize(csvName);
    const candPack  = ProductMetadataParser.extractPackSize(candName) ||
                      ProductMetadataParser.extractPackSize(candidate.rawPackInfo || '');

    const conflicts = [];
    const matched   = [];

    // ── Variant conflict (strict) ────────────────────────────────────────────
    const variants = [
      { key: 'zero',       keywords: ['zero', 'zero sugar', 'no sugar'] },
      { key: 'diet',       keywords: ['diet', 'light', 'lite'] },
      { key: 'max',        keywords: ['max'] },
      { key: 'sugar free', keywords: ['sugar free', 'sugarfree'] },
      { key: 'cherry',     keywords: ['cherry'] },
      { key: 'original',   keywords: ['original', 'regular'] },
    ];
    for (const v of variants) {
      const csvHas  = v.keywords.some(k => csvName.includes(k));
      const candHas = v.keywords.some(k => candName.includes(k));
      if (['zero', 'diet', 'max', 'cherry', 'sugar free'].includes(v.key)) {
        if (csvHas && !candHas)  conflicts.push(`variant_${v.key}`);
        if (!csvHas && candHas && csvName.includes('original')) conflicts.push(`variant_${v.key}`);
      }
    }

    // ── Category conflict ────────────────────────────────────────────────────
    const categoryPairs = [
      ['energy', 'biscuit'], ['crisps', 'biscuit'], ['coffee', 'tea'],
      ['beans', 'soup'], ['water', 'juice'], ['chocolate', 'crisps'],
    ];
    for (const [cat1, cat2] of categoryPairs) {
      if (csvName.includes(cat1) && candName.includes(cat2) && !csvName.includes(cat2)) conflicts.push(`cat_${cat1}_vs_${cat2}`);
      if (csvName.includes(cat2) && candName.includes(cat1) && !csvName.includes(cat1)) conflicts.push(`cat_${cat2}_vs_${cat1}`);
    }

    // ── Brand/Volume/Weight conflicts ────────────────────────────────────────
    if (csvBrand  && candBrand  && csvBrand  !== candBrand  && !candName.includes(csvBrand))  conflicts.push('brand');
    if (csvVol    && candVol    && csvVol    !== candVol)    conflicts.push('volume');
    if (csvWeight && candWeight && csvWeight !== candWeight) conflicts.push('weight');
    if (csvPack   && candPack   && csvPack   !== candPack)   conflicts.push('pack');

    if (conflicts.length > 0) {
      return {
        result_status: 'rejected',
        validation_score: 0,
        validation_reason: `Metadata conflicts: ${conflicts.join(', ')}`,
        conflicting_fields: conflicts.join(','),
        ...candidate,
      };
    }

    // ── Match scoring ────────────────────────────────────────────────────────
    if (csvBrand  && (candBrand === csvBrand || candName.includes(csvBrand))) matched.push('brand');
    if (csvVol    && candVol    && csvVol    === candVol)    matched.push('volume');
    if (csvWeight && candWeight && csvWeight === candWeight) matched.push('weight');
    if (csvPack   && candPack   && csvPack   === candPack)   matched.push('pack');

    const brandOk  = matched.includes('brand');
    const unitOk   = matched.includes('volume') || matched.includes('weight');
    const packOk   = matched.includes('pack');

    let score = 45;
    if (brandOk && unitOk && packOk)   score = 95;
    else if (brandOk && unitOk)        score = 88;
    else if (brandOk && packOk)        score = 82;
    else if (brandOk)                  score = 68;
    else if (ProductMetadataParser.normalizeText(csvName) === ProductMetadataParser.normalizeText(candName)) score = 85;
    else if (unitOk || packOk)         score = 55;

    // Barcode strategy boost (cannot push ambiguous to success threshold)
    if (strategy === 'barcode' || strategy === 'normalized_barcode') {
      score = score >= 90 ? Math.min(99, score + 4) : Math.min(89, score + 12);
      matched.push('supplier_barcode_search');
    }

    let status = 'rejected';
    if (score >= 90)      status = 'success';
    else if (score >= 60) status = 'ambiguous';

    return {
      result_status: status,
      validation_score: score,
      validation_reason: `Bestway score ${score}. Matched: [${matched.join(', ')}]`,
      matched_fields: matched.join(','),
      ...candidate,
    };
  }

  // ─── Extract EAN from Bestway image URL ──────────────────────────────────────
  // Image URLs follow pattern: /img/products/100/{digit}/{EAN}.jpg
  extractEanFromImageUrl(imageUrl) {
    if (!imageUrl) return null;
    const url = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
    const match = url.match(/\/(\d{8,14})\.jpg$/i);
    return match ? match[1] : null;
  }

  // ─── Derive case price from RSP and minPOR ────────────────────────────────────
  // minPOR = Minimum Percentage of Retail = the retailer margin %
  // rsp    = Recommended Selling Price (per unit/pack, depending on product)
  // case_price = rsp × (1 - minPOR/100) × packCount
  // If packCount is missing or invalid, return null (NEVER store unit cost as case price).
  deriveCasePrice(rsp, minPOR, packCount) {
    if (!rsp || !minPOR || !packCount || packCount <= 0) return null;
    const rspNum  = parseFloat(rsp);
    const porNum  = parseFloat(minPOR);
    if (isNaN(rspNum) || isNaN(porNum)) return null;

    // Unit cost price (what the retailer pays per unit to achieve minPOR margin at RSP)
    const unitCost = rspNum * (1 - porNum / 100);

    // Case price = unit cost × pack count
    return parseFloat((unitCost * packCount).toFixed(2));
  }

  // ─── Extract pack count from product title ────────────────────────────────────
  extractPackCount(title) {
    if (!title) return null;
    // Patterns: "24x500ml", "Pack of 12", "4 Pack", "6 x 330ml"
    const patterns = [
      /^(\d{1,3})\s*[x×]\s*\d/i,     // 24x500ml or 6 × 330ml
      /\b(\d{1,3})\s*[x×]\s*\d/i,
      /\bpack\s+of\s+(\d{1,3})\b/i,
      /\b(\d{1,3})\s*pack\b/i,
      /\b(\d{1,3})\s*can/i,
      /\b(\d{1,3})\s*bottle/i,
      /productDimensions:\s*(\d{1,3})/i,
    ];
    for (const p of patterns) {
      const m = title.match(p);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 2 && n <= 200) return n;  // sanity bounds for pack count
      }
    }
    return null;
  }

  // ─── Map Unbxd product to internal candidate format ───────────────────────────
  mapUnbxdProduct(product) {
    const rawTitle      = product.title || product.autosuggest || null;
    
    let rawUrl = product.productUrl || product.hrefUrl || null;
    if (rawUrl && !rawUrl.startsWith('http')) {
      rawUrl = `https://www.bestwaywholesale.co.uk${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    }

    const rawProductCode = product.uniqueId ? String(product.uniqueId).trim() : null;

    // EAN from image URL
    const imageUrl = Array.isArray(product.imageUrl) ? product.imageUrl[0] : product.imageUrl;
    const rawBarcode = this.extractEanFromImageUrl(imageUrl);

    // RSP and minPOR
    const rsp    = product.rsp ? parseFloat(product.rsp) : null;
    const minPOR = product.minPOR ? parseFloat(product.minPOR) : null;

    // Pack info from productDimensions or title
    const rawPackInfo = product.productDimensions || null;

    // Pack count from title or productDimensions
    const packCount = this.extractPackCount(rawTitle) ||
                      this.extractPackCount(rawPackInfo);

    // Derive case price (returns null if packCount is missing)
    const price = this.deriveCasePrice(rsp, minPOR, packCount);

    // Stock — presence in search results with depot filter implies in-stock
    const inStock = true; // depot_number_inStock_Y filter ensures this

    // Promotion — RSP in title with "PM £x" pattern (Price-Marked)
    const promotionFlag = /\bPM\s+£[\d.]+/i.test(rawTitle || '');
    const promotionDesc = promotionFlag ? 'Price-Marked Pack' : null;

    // Brand from autosuggestBrand or title extraction
    const brandName = product.autosuggestBrand || null;

    return {
      rawTitle,
      rawBarcode,
      rawPackInfo,
      supplierProductId: rawProductCode,
      rawProductCode,
      rawUrl,
      productUrl: rawUrl,
      price,
      rsp,
      minPOR,
      packCount,
      inStock,
      promotionFlag,
      promotionDesc,
      brandName,
      category: null,      // not exposed in search results
      vatStatus: null,     // not exposed
    };
  }

  // ─── Unbxd search API call (does NOT require browser) ────────────────────────
  async callUnbxdSearch(term, rows = 24) {
    return new Promise((resolve, reject) => {
      const depot = this.depotNumber || '208';
      const filter = `depot_number_inStock_Y:"${depot}"`;
      const fields = [
        'doctype', 'title', 'productDimensions', 'productUrl', 'imageUrl',
        'rsp', 'uniqueId', 'minPOR', 'DesktopImageurl', 'hrefUrl',
        'altText', 'KeywordsTags', 'autosuggestBrand', 'autosuggest',
      ].join(',');

      const params = new URLSearchParams({
        q:        term,
        rows:     String(rows),
        start:    '0',
        fields,
        filter,
        indent:   'off',
        facet:    'off',
        analytics:'false',
        redirect: 'false',
      });

      const url = `${UNBXD_SEARCH_BASE}/search?${params.toString()}`;

      const options = {
        method: 'GET',
        headers: {
          'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept':         'application/json, text/plain, */*',
          'Accept-Language':'en-GB,en;q=0.9',
          'Referer':        `${BASE_URL}/`,
          'Origin':         BASE_URL,
          ...(this.sessionCookieHeader ? { 'Cookie': this.sessionCookieHeader } : {}),
        },
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`Unbxd response parse error: ${e.message}. Preview: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(20000, () => {
        req.destroy();
        reject(new Error('Unbxd API request timed out'));
      });
      req.end();
    });
  }

  // ─── executeSearch — uses Unbxd REST API ──────────────────────────────────────
  async executeSearch(pg, term, strategy) {
    try {
      console.log(`[Bestway]   Unbxd API search: "${term}" (${strategy})`);
      const response = await this.callUnbxdSearch(term, 24);

      if (!response || !response.response) {
        console.warn(`[Bestway]   Unexpected API response structure.`);
        return [];
      }

      // Handle redirect (e.g. "coca-cola" redirects to brand page)
      if (response.redirect && response.response.numberOfProducts === 0) {
        console.log(`[Bestway]   API redirect detected: ${response.redirect.value}. Zero products in main results.`);
        // Redirect responses have no search results — treat as not found for this term
        return [];
      }

      const total = response.response.numberOfProducts ?? 0;
      const products = response.response.products || [];
      console.log(`[Bestway]   ${total} total results, processing ${products.length}.`);

      const candidates = products
        .map(p => this.mapUnbxdProduct(p))
        .filter(c => c.rawTitle);

      return candidates;
    } catch (err) {
      console.error(`[Bestway]   executeSearch error for "${term}": ${err.message}`);
      return [];
    }
  }

  // ─── Cookie consent handler ───────────────────────────────────────────────────
  async handleCookieConsent(pg) {
    try {
      const btn = pg.locator('button:has-text("Accept Cookies"), button:has-text("Accept All"), #onetrust-accept-btn-handler');
      if (await btn.count() > 0) {
        await btn.first().click({ timeout: 5000 });
        await pg.waitForTimeout(1500);
        console.log('[Bestway] Cookie consent accepted.');
      }
    } catch { /* not present */ }
  }

  // ─── OAuth2 Login and account selection ──────────────────────────────────────
  async login() {
    const username = process.env.BESTWAY_USERNAME;
    const password = process.env.BESTWAY_PASSWORD;
    const targetAccount = process.env.BESTWAY_ACCOUNT || null;

    if (!username || !password) {
      throw new Error('[Bestway] BESTWAY_USERNAME or BESTWAY_PASSWORD not set.');
    }

    console.log('[Bestway] Starting authentication...');

    const hasState = fs.existsSync(STORAGE_STATE_PATH);
    const headless = process.env.SCRAPER_HEADLESS !== 'false'; // default headless

    this.browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--lang=en-GB'],
    });

    const contextOptions = {
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    };
    if (hasState) {
      contextOptions.storageState = STORAGE_STATE_PATH;
      console.log('[Bestway] Loading saved session state...');
    }

    this.context = await this.browser.newContext(contextOptions);
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });
    this.page = await this.context.newPage();

    // ── Navigate to site ─────────────────────────────────────────────────────
    try {
      await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e) {
      console.warn('[Bestway] Navigation warning (non-fatal):', e.message.substring(0, 80));
    }
    await this.page.waitForTimeout(4000);
    console.log(`[Bestway] Initial URL: ${this.page.url()}`);

    // ── Handle full login flow if not already authenticated ──────────────────
    if (this.page.url().includes('auth.bestwaywholesale') || this.page.url().includes('/login') || this.page.url().includes('switch-account')) {
      
      // Delete stale state if we're landing on login
      if (hasState && (this.page.url().includes('auth.bestwaywholesale') || this.page.url().includes('/login'))) {
        fs.unlinkSync(STORAGE_STATE_PATH);
        console.log('[Bestway] Stale session state removed. Re-authenticating...');
      }

      // Fill login form if on auth page
      if (this.page.url().includes('auth.bestwaywholesale') || this.page.url().includes('/login')) {
        await this.page.waitForSelector('#loginId, input[type="email"]', { timeout: 15000 }).catch(() => {});
        await this.page.fill('#loginId, input[type="email"]', username).catch(() => {});
        await this.page.fill('#password, input[name="password"]', password).catch(() => {});
        await this.page.locator('button:has-text("Log In"), button[type="submit"]').first().click().catch(() => {});
        await this.page.waitForTimeout(7000);
        console.log(`[Bestway] URL after login submit: ${this.page.url()}`);
      }

      // ── Handle /switch-account page ─────────────────────────────────────────
      if (this.page.url().includes('switch-account')) {
        console.log('[Bestway] Account selection page detected.');
        
        const accountOptions = await this.page.evaluate(() => {
          const sel = document.querySelector('select');
          if (!sel) return [];
          return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() }));
        });

        console.log(`[Bestway] Available accounts: ${accountOptions.map(a => a.value).join(', ')}`);

        // Select the configured account, or fall back to the first one
        const accountToSelect = targetAccount && accountOptions.find(a => a.value === targetAccount)
          ? targetAccount
          : accountOptions[0]?.value;

        if (!accountToSelect) {
          throw new Error('[Bestway] No accounts available on switch-account page.');
        }

        await this.page.selectOption('select', accountToSelect);
        console.log(`[Bestway] Selected account: ${accountToSelect}`);
        await this.page.waitForTimeout(1000);

        // Submit account selection
        await this.page.locator('input[type="submit"], button[type="submit"], button:has-text("Continue"), button:has-text("Confirm")').first().click().catch(() => {});
        await this.page.waitForTimeout(5000);
        console.log(`[Bestway] URL after account selection: ${this.page.url()}`);
      }
    }

    // ── Handle cookie consent after login ─────────────────────────────────────
    await this.handleCookieConsent(this.page);

    // ── Extract session cookies for API calls ─────────────────────────────────
    const cookies = await this.context.cookies();
    this.sessionCookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Extract depot number
    const depotCookie = cookies.find(c => c.name === 'unbxd_depot');
    if (depotCookie) {
      this.depotNumber = depotCookie.value;
      console.log(`[Bestway] Detected depot number: ${this.depotNumber}`);
    } else if (!this.depotNumber) {
      this.depotNumber = '208'; // fallback
      console.warn('[Bestway] unbxd_depot cookie not found — using fallback depot 208.');
    }

    // ── Verify authentication ─────────────────────────────────────────────────
    const authenticated = await this.page.evaluate(() => {
      const body = document.body?.innerText || '';
      return body.includes('LOGGED IN AS') || body.includes('logout') || body.includes('Logout') || body.includes('Sign Out');
    });

    if (!authenticated) {
      const currentUrl = this.page.url();
      if (currentUrl.includes('auth.bestwaywholesale') || currentUrl.includes('/login')) {
        throw new Error('[Bestway] Authentication failed — still on login page after submit.');
      }
      console.warn('[Bestway] Authentication status uncertain, but not on login page. Proceeding.');
    } else {
      console.log('[Bestway] ✓ Authentication confirmed.');
    }

    // ── Save session state for next run ───────────────────────────────────────
    await this.context.storageState({ path: STORAGE_STATE_PATH }).catch(e => {
      console.warn('[Bestway] Could not save session state:', e.message);
    });

    console.log('[Bestway] ✓ Login complete. Unbxd API calls will use authenticated depot context.');
    return this.page;
  }

  // ─── Close ───────────────────────────────────────────────────────────────────
  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.page    = null;
    }
  }
}

module.exports = BestwayScraper;
