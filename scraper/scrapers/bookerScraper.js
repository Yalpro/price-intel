const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BaseScraper = require('./BaseScraper');

const STORAGE_STATE_PATH = path.join(__dirname, 'booker_state.json');

class BookerScraper extends BaseScraper {
  constructor() {
    super('booker');
    this.browser = null;
    this.context = null;
    this.page = null;
    
    this.capabilities = {
      supportsBarcodeSearch: true,
      supportsNameSearch: true,
      supportsDirectProductRedirect: false,
      supportsMultipleResults: true,
      supportsStockStatus: true,
      supportsPromotionBadges: true,
      exposesBarcodesInDOM: true,
    };
  }

  async login() {
    const email = process.env.BOOKER_EMAIL; // To be confirmed if this is customer number
    const password = process.env.BOOKER_PASSWORD;

    if (!email || !password) {
      console.error('Booker credentials missing in .env');
      return null;
    }

    const hasState = fs.existsSync(STORAGE_STATE_PATH);
    const headless = process.env.SCRAPER_HEADLESS === 'true';

    this.browser = await chromium.launch({ headless });
    this.context = hasState
      ? await this.browser.newContext({ storageState: STORAGE_STATE_PATH })
      : await this.browser.newContext();

    this.page = await this.context.newPage();
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    try {
      console.log('[Booker] Navigating to homepage...');
      await this.page.goto('https://www.booker.co.uk', { waitUntil: 'domcontentloaded' });
      
      // TODO: Implement Cookiebot consent handling
      // TODO: Implement actual login logic using customer number & password
      // TODO: Implement branch selection if required

      console.warn('[Booker] Login implementation pending valid production credentials.');
      return this.page; 
    } catch (err) {
      console.error('[Booker] Login failed:', err.message);
      return null;
    }
  }

  async executeSearch(pg, term, strategy) {
    try {
      const searchUrl = `https://www.booker.co.uk/products/product-search?keywords=${encodeURIComponent(term)}`;
      await pg.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4000);

      const candidates = [];
      
      // TODO: Implement extraction logic using the ProductCardDecorator or __NEXT_DATA__ JSON structure

      return candidates;
    } catch (err) {
      console.error(`[Booker] executeSearch failed for ${term}:`, err.message);
      return [];
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

module.exports = BookerScraper;
