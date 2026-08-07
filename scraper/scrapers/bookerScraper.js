const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const path = require('path');
const fs = require('fs');
const { BaseScraper } = require('./BaseScraper');

class BookerScraper extends BaseScraper {
  constructor() {
    super('booker');
    
    // 5. BOOKER CAPABILITY CONFIGURATION
    this.capabilities = {
      supportsBarcodeSearch: true,
      supportsNameSearch: true,
      supportsDirectProductRedirect: false, // Assume false initially for safety
      supportsMultipleResults: true,
      supportsStockStatus: true,
      supportsPromotionBadges: true,
      exposesBarcodesInDOM: false,
      requiresBranchSelection: true,
      requiresAccountSelection: false,
      supportsPagination: true,
      supportsInfiniteScroll: false,
      integrationType: 'api' // Prefer stable internal API
    };
  }

  async login() {
    const customerNumber = process.env.BOOKER_CUSTOMER_NUMBER;
    const email = process.env.BOOKER_EMAIL;
    const password = process.env.BOOKER_PASSWORD;
    const baseUrl = process.env.BOOKER_BASE_URL || 'https://www.booker.co.uk';
    const statePath = process.env.BOOKER_STORAGE_STATE_PATH || './sessions/booker_state.json';

    if (!customerNumber || !email || !password) {
      console.error('[Booker] Credentials missing in .env');
      return null;
    }

    const hasState = fs.existsSync(statePath);
    // Force headed mode for Booker because Akamai blocks headless even with stealth
    const headless = false;

    this.browser = await chromium.launch({ headless });
    this.context = hasState
      ? await this.browser.newContext({ storageState: statePath, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' })
      : await this.browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

    this.page = await this.context.newPage();

    try {
      console.log('[Booker] Navigating to homepage...');
      await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      // Check for authenticated session
      const isLoggedIn = await this.verifySession(this.page);

      if (!isLoggedIn) {
         console.log('[Booker] Session expired or not logged in. Proceeding with production login flow...');
         
         // Clear any stale state to ensure clean login
         await this.context.clearCookies();

         // Navigate through the actual login flow
         await this.performLoginFlow(this.page, customerNumber, email, password);

         const verified = await this.verifySession(this.page);
         if (!verified) {
           throw new Error('Authentication verification failed after login flow.');
         }

         // Save Playwright storage state outside source control
         const dir = path.dirname(statePath);
         if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
         await this.context.storageState({ path: statePath });
         console.log('[Booker] ✓ Session state saved for future reuse.');

      } else {
         console.log('[Booker] ✓ Reusing valid authenticated session.');
      }

      return this.page; 
    } catch (err) {
      console.error('[Booker] Login failed:', err.message);
      return null;
    }
  }

  async verifySession(pg) {
    try {
      // Validate authentication by attempting to access a search page.
      // If we are not logged in, Booker redirects to /login or shows a login page.
      await pg.goto(`${process.env.BOOKER_BASE_URL || 'https://www.booker.co.uk'}/products/product-search?keywords=test`, { waitUntil: 'domcontentloaded' });
      const pageTitle = await pg.title();
      
      if (pageTitle.toLowerCase().includes('login') || pageTitle.toLowerCase().includes('sign in')) {
        return false;
      }
      
      // If we reached the search page successfully, we are authenticated.
      return true;
    } catch (e) {
      return false;
    }
  }

  async performLoginFlow(pg, customerNumber, email, password) {
    // Cookie consent
    try {
      const cookieBtn = pg.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll').first();
      if (await cookieBtn.isVisible({ timeout: 2000 })) {
        await cookieBtn.click();
        await pg.waitForTimeout(1000);
      }
    } catch (e) { /* Ignore */ }

    // Click Login link/button
    try {
      const signInBtn = pg.locator('button:has-text("Sign in / Join"), button:has-text("Sign in")').first();
      await signInBtn.click();
    } catch (e) {
      console.log('[Booker] Could not click login link. Navigating to /login fallback.');
      await pg.goto(`${process.env.BOOKER_BASE_URL || 'https://www.booker.co.uk'}/?login=true&returnUrl=https%3A%2F%2Fwww.booker.co.uk%2Faccount%2F`, { waitUntil: 'domcontentloaded' });
    }

    await pg.waitForTimeout(3000);

    // Enter Customer Number
    const customerInput = pg.locator('input[placeholder*="customer" i]').first();
    await customerInput.waitFor({ state: 'visible', timeout: 10000 });
    await customerInput.fill(customerNumber);
    
    // Continue
    const continueBtn = pg.locator('button:has-text("Continue")').first();
    if (await continueBtn.isVisible({ timeout: 2000 })) {
       await continueBtn.click();
       await pg.waitForTimeout(2000);
    }

    // Enter Email
    const emailInput = pg.locator('input[type="email"]').first();
    await emailInput.fill(email);

    // Enter Password
    const passwordInput = pg.locator('input[type="password"]').first();
    await passwordInput.fill(password);

    // Submit
    const submitBtn = pg.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Wait for navigation and potential WAF check
    await pg.waitForTimeout(5000);
  }

  async executeSearch(pg, term, strategy) {
    try {
      // API DISCOVERY FIRST: prefer internal API
      // If we captured an API endpoint during discovery, we would use fetch here.
      // E.g., const response = await pg.request.get(\`/api/search?q=\${encodeURIComponent(term)}\`);
      
      // Fallback to DOM extraction
      const searchUrl = `https://www.booker.co.uk/products/product-search?keywords=${encodeURIComponent(term)}`;
      await pg.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await Promise.race([
        pg.waitForSelector('a[href*="/products/product?Code="]', { timeout: 2500 }).catch(() => {}),
        pg.waitForTimeout(1500)
      ]);

      const candidates = [];
      
      // Check for __NEXT_DATA__ (React structured state)
      const hasNextData = await pg.evaluate(() => !!window.__NEXT_DATA__);
      if (hasNextData) {
        const nextData = await pg.evaluate(() => window.__NEXT_DATA__);
        // Safely extract from nextData if it contains product results
        // This avoids DOM scraping fragility
        try {
           const products = nextData?.props?.pageProps?.initialState?.search?.results || [];
           for (const p of products) {
              candidates.push(this.mapApiProductToCandidate(p));
           }
           if (candidates.length > 0) return candidates;
        } catch (e) {
           console.log('[Booker] Failed to parse __NEXT_DATA__, falling back to DOM');
        }
      }

      // DOM scraping fallback using the exact code extraction logic
      const extractedProducts = await pg.evaluate(() => {
        const results = [];
        const links = Array.from(document.querySelectorAll('a[href*="/products/product?Code="]'));
        const codes = [...new Set(links.map(a => new URL(a.href, 'https://www.booker.co.uk').searchParams.get('Code')))];
        
        for (const code of codes) {
          const titleLink = document.querySelector(`h3 a[href*="Code=${code}"]`);
          if (!titleLink) continue;
          
          const title = titleLink.innerText.trim();
          
          let container = titleLink.parentElement;
          while (container && container.tagName !== 'BODY') {
            if (container.querySelector('button') && container.innerText.includes('£')) break;
            container = container.parentElement;
          }
          
          if (!container || container.tagName === 'BODY') continue;

          const packInfoEl = container.querySelector('ul > li');
          const packInfo = packInfoEl ? packInfoEl.innerText.trim() : null;
          
          const textNodes = Array.from(container.querySelectorAll('*')).filter(el => el.children.length === 0 && el.innerText && el.innerText.includes('£'));
          let price = null;
          for (const node of textNodes) {
            const match = node.innerText.match(/£([0-9]+\.[0-9]{2})/);
            if (match && !node.innerText.toLowerCase().includes('incl. vat') && !node.innerText.toLowerCase().includes('was')) {
               price = parseFloat(match[1]);
               break;
            }
          }

          const barcodeMatch = container.innerText.match(/\b\d{13}\b/);
          const barcode = barcodeMatch ? barcodeMatch[0] : null;

          const inStock = !container.innerText.toLowerCase().includes('out of stock');
          const promoBadge = container.innerText.toLowerCase().includes('offer') ? 'Offer' : null;

          results.push({
            supplierProductId: code,
            rawTitle: title,
            rawBarcode: barcode,
            rawPackInfo: packInfo,
            price: price,
            inStock: inStock,
            promotionFlag: !!promoBadge,
            promotionDescription: promoBadge
          });
        }
        return results;
      });

      if (extractedProducts.length === 0) {
        // ALWAYS capture debug evidence on failure to see what Akamai/Booker is doing
        await this.captureDebugEvidence(pg, term, 'a[href*="/products/product?Code="]', 0);
        return candidates;
      }
      
      return extractedProducts;

      return candidates;
    } catch (err) {
      console.error(`[Booker] executeSearch failed for ${term}:`, err.message);
      return [];
    }
  }

  mapApiProductToCandidate(apiProd) {
    return {
      supplierProductId: apiProd.id || apiProd.code,
      rawTitle: apiProd.name || apiProd.title,
      rawBarcode: apiProd.ean || apiProd.barcode,
      rawPackInfo: apiProd.packSize || apiProd.size,
      price: apiProd.price ? parseFloat(apiProd.price) : null,
      inStock: apiProd.stockStatus !== 'OUT_OF_STOCK',
      promotionFlag: !!apiProd.promotion,
      promotionDescription: apiProd.promotion?.description || null
    };
  }

}

module.exports = BookerScraper;
