const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { BaseScraper } = require('./BaseScraper');
const ProductMetadataParser = require('../utils/ProductMetadataParser');

const STORAGE_STATE_PATH = path.join(__dirname, 'parfetts_state.json');

class ParfettsScraper extends BaseScraper {
  constructor() {
    super('parfetts');
    this.browser = null;
    this.context = null;
    this.page = null;
    
    this.capabilities = {
      supportsBarcodeSearch: true,
      supportsNameSearch: true,
      supportsDirectProductRedirect: true,
      supportsMultipleResults: true,
      supportsStockStatus: true,
      supportsPromotionBadges: true,
      exposesBarcodesInDOM: false, 
    };
  }

  async handleAccountModal(pg) {
    try {
      // Parfetts uses a Bootstrap modal with a React Select dropdown for account selection.
      // Modal class: .customer-select-modal | React Select control: .customer-select__control
      // We wait up to 5s for the modal; if it doesn't appear, we continue silently.
      const modalLocator = pg.locator('.customer-select-modal, .modal:has(h1:text("Choose An Account"))');
      const modalCount = await modalLocator.count();

      if (modalCount === 0) {
        // Wait a moment and re-check (modal may render after JS hydration)
        await pg.waitForTimeout(2000);
        const retryCount = await modalLocator.count();
        if (retryCount === 0) {
          console.log('[Parfetts] No account modal — continuing.');
          return;
        }
      }

      console.log('[Parfetts] Account selection modal detected.');

      // Click the React Select control to open the dropdown
      const selectControl = pg.locator('.customer-select__control').first();
      await selectControl.waitFor({ state: 'visible', timeout: 10000 });
      await selectControl.click();
      await pg.waitForTimeout(1000);

      // After clicking, React Select renders options in .customer-select__menu or a portal
      // Click the first option
      const firstOption = pg.locator('[role="option"], [id*="react-select"][id*="-option-"]').first();
      await firstOption.waitFor({ state: 'visible', timeout: 8000 });
      console.log('[Parfetts] Clicking first account option...');
      await firstOption.click();
      await pg.waitForTimeout(2000);

      // The modal should close after selection — wait for it to disappear
      await modalLocator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
        console.warn('[Parfetts] Modal did not close — proceeding anyway.');
      });

      console.log('[Parfetts] Account selected successfully.');
    } catch (err) {
      console.warn('[Parfetts] Could not handle account modal:', err.message);
    }
  }



  async isLoggedIn(pg) {
    const loginLinks = await pg.locator('a[href="/login"], a[href*="/login?path"]').count();
    return loginLinks === 0;
  }

  async doLogin(pg) {
    const email = process.env.PARFETTS_EMAIL;
    const password = process.env.PARFETTS_PASSWORD;

    console.log('[Parfetts] Navigating to /login...');
    await pg.goto('https://online.parfetts.co.uk/login', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(2000);

    const urlAfterNav = pg.url();
    console.log('[Parfetts] URL after /login navigation:', urlAfterNav);

    // If we got redirected away from /login, we're already authenticated
    if (!urlAfterNav.includes('/login')) {
      console.log('[Parfetts] Auto-redirected from /login — already authenticated.');
      await this.handleAccountModal(pg);
      await pg.goto('https://online.parfetts.co.uk/', { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(2000);
      return;
    }

    // Fill the form — Parfetts uses type="text" name="email" (NOT type="email")
    console.log('[Parfetts] Filling login form...');
    await pg.waitForSelector('input[name="email"]', { timeout: 15000 });
    await pg.fill('input[name="email"]', email);
    await pg.fill('input[name="password"]', password);

    // Click "Sign in" button — use text fallback if :has-text fails
    const signInBtn = pg.locator('button:has-text("Sign in"), button[type="submit"]').last();
    console.log('[Parfetts] Clicking Sign in button...');
    await signInBtn.click({ timeout: 15000 });

    await pg.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {
      console.warn('[Parfetts] No navigation event after sign in — continuing anyway.');
    });
    await pg.waitForTimeout(3000);

    const urlAfterLogin = pg.url();
    console.log('[Parfetts] URL after sign in:', urlAfterLogin);

    // Handle the "Choose An Account" modal that appears after login
    await this.handleAccountModal(pg);

    // Navigate to homepage to ensure clean state
    await pg.goto('https://online.parfetts.co.uk/', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3000);
  }


  async ensureAuthenticated(pg) {
    if (await this.isLoggedIn(pg)) return true;

    console.warn('[Parfetts] Session expired mid-run — re-authenticating...');
    if (fs.existsSync(STORAGE_STATE_PATH)) fs.unlinkSync(STORAGE_STATE_PATH);

    await this.doLogin(pg);
    if (!(await this.isLoggedIn(pg))) {
      console.error('[Parfetts] Re-login failed.');
      return false;
    }

    await this.context.storageState({ path: STORAGE_STATE_PATH });
    await pg.goto('https://online.parfetts.co.uk/', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3000);
    return true;
  }

  async login() {
    const email = process.env.PARFETTS_EMAIL;
    const password = process.env.PARFETTS_PASSWORD;

    if (!email || !password) {
      console.error('Parfetts credentials missing in .env');
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
      console.log('[Parfetts] Navigating to homepage...');
      await this.page.goto('https://online.parfetts.co.uk/', { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(4000);

      if (!(await this.isLoggedIn(this.page))) {
        if (hasState) fs.unlinkSync(STORAGE_STATE_PATH);
        await this.doLogin(this.page);
        if (!(await this.isLoggedIn(this.page))) {
          console.error('[Parfetts] Login appeared to complete but still unauthenticated.');
          return null;
        }
        await this.context.storageState({ path: STORAGE_STATE_PATH });
      } else {
        console.log('[Parfetts] Session restored from state. Ensuring account is selected...');
        await this.handleAccountModal(this.page);
      }

      return this.page;
    } catch (err) {
      console.error('[Parfetts] Login failed:', err.message);
      return null;
    }
  }

  async executeSearch(pg, term, strategy) {
    if (!(await this.ensureAuthenticated(pg))) return [];

    try {
      const searchUrl = `https://online.parfetts.co.uk/search?q=${encodeURIComponent(term)}`;
      await pg.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4000);

      const currentUrl = pg.url();
      const bodyText = await pg.innerText('body');
      const lowerBody = bodyText.toLowerCase();

      if (lowerBody.includes('no results found') || lowerBody.includes('could not find') || lowerBody.includes('all (0)')) {
        return [];
      }

      const onProductPage = /\/product\/\d+/.test(currentUrl);
      const candidates = [];

      if (onProductPage) {
        // Single product match - extract data from the product detail page
        let rawTitle = null;
        for (const sel of ['h1', 'h2', 'h5']) {
          const el = pg.locator(sel).first();
          if (await el.count() > 0) {
            rawTitle = (await el.innerText()).trim();
            if (rawTitle) break;
          }
        }

        let rawPackInfo = null;
        const packRow = pg.locator('tr:has(th:has-text("Pack Size")), tr:has(td:text-is("Pack Size"))');
        if (await packRow.count() > 0) {
          const td = packRow.locator('td').last();
          if (await td.count() > 0) rawPackInfo = (await td.innerText()).trim();
        }

        if (!rawPackInfo) {
          const packSelectors = ['[class*="pack"]', '[class*="size"]', '[class*="unit"]', 'p:has-text("ml")', 'p:has-text("kg")', 'li:has-text("Size:")'];
          for (const sel of packSelectors) {
            const el = pg.locator(sel).first();
            if (await el.count() > 0) {
              const t = (await el.innerText()).trim();
              if (t.length > 0 && t.length < 50) { rawPackInfo = t; break; }
            }
          }
        }

        const priceData = await pg.evaluate(() => {
          const spans = Array.from(document.querySelectorAll('span.font-bold, span[class*="price"], p[class*="price"]'));
          const prices = [];
          for (const span of spans) {
            const match = span.textContent.trim().match(/^£\s?(\d+\.\d{2})$/);
            if (match && parseFloat(match[1]) > 0) prices.push(parseFloat(match[1]));
          }
          return prices;
        });

        if (!priceData || priceData.length === 0) {
          const pageContent = await pg.content();
          const allPriceMatches = pageContent.match(/£(\d+\.\d{2})/g) || [];
          const nonZeroPrices = allPriceMatches.map(p => parseFloat(p.replace('£', ''))).filter(p => p > 0);
          if (nonZeroPrices.length > 0) priceData.push(nonZeroPrices[0]);
        }

        const price = priceData.length > 0 ? priceData[0] : null;

        // FIX 4: Multi-signal stock detection (Priority order: OOS text > Disabled button > In Stock text > Enabled Add button > Qty input)
        const pageText = (await pg.innerText('body')).toLowerCase();
        const hasOutOfStockText = pageText.includes('out of stock') || pageText.includes('currently unavailable') || pageText.includes('discontinued');
        const hasInStockText = pageText.includes('in stock') || pageText.includes('low stock');

        const enabledAddBtnCount = await pg.locator('button[aria-label*="trolley" i]:not([disabled]), button[aria-label*="add" i]:not([disabled])').count();
        const disabledAddBtnCount = await pg.locator('button[aria-label*="trolley" i][disabled], button[aria-label*="add" i][disabled], button.disabled').count();
        const altProductsBtnCount = await pg.locator('button:has-text("View Alternative Products")').count();
        const qtyInputCount = await pg.locator('input[type="number"]:not([disabled])').count();

        const isExplicitOOS = hasOutOfStockText || altProductsBtnCount > 0;
        const isDisabledBtn = disabledAddBtnCount > 0;
        const isExplicitInStock = hasInStockText;
        const isEnabledAddBtn = enabledAddBtnCount > 0 && altProductsBtnCount === 0;
        const isQtyInputAvailable = qtyInputCount > 0;

        const negSignals = (isExplicitOOS ? 1 : 0) + (isDisabledBtn ? 1 : 0);
        const posSignals = (isExplicitInStock ? 1 : 0) + (isEnabledAddBtn ? 1 : 0) + (isQtyInputAvailable ? 1 : 0);

        let inStock = null;
        if (negSignals > 0 && posSignals > 0) {
          inStock = null; // Conflicting signals -> UNKNOWN
        } else if (negSignals > 0) {
          inStock = false;
        } else if (posSignals > 0) {
          inStock = true;
        } else {
          inStock = null; // Zero signals -> UNKNOWN (never guess based on price)
        }
        
        const promoBadgeCount = await pg.locator('[class*="promo"], [class*="badge"], [class*="offer"], .text-red-500:has-text("offer")').count();
        const promotionFlag = promoBadgeCount > 0 || (rawTitle && (rawTitle.toLowerCase().includes('promo') || rawTitle.toLowerCase().includes('offer')));

        candidates.push({
          rawTitle,
          rawPackInfo: ProductMetadataParser.sanitizePackInfo(rawPackInfo),
          price,
          inStock,
          promotionFlag,
          rawBarcode: null // Parfetts PDP doesn't reliably expose barcode in DOM
        });
      } else {
        // Search results page with multiple items
        const items = await pg.evaluate(() => {
          // Find links to products to locate the product cards
          const links = Array.from(document.querySelectorAll('a[href*="/product/"]'));
          const cards = links.map(l => l.closest('div.bg-white, li, .border, .shadow, [class*="col-"]')).filter((v,i,a) => v && a.indexOf(v)===i);
          
          if (cards.length === 0) return [];
          
          return cards.map(card => {
            const titleEl = card.querySelector('h2, h3, h4, .product-title, [class*="title"], .product-name, div.font-bold');
            const title = titleEl ? titleEl.textContent.trim() : null;
            
            let packInfo = null;
            // Refined DOM query: target elements specific to pack/size options, avoid generic card container divs
            const packEls = card.querySelectorAll('[class*="pack"], [class*="size"], .product-option, p, span');
            for (const p of packEls) {
              const text = p.textContent.trim();
              if (text.includes('Pack Size')) {
                  const match = text.match(/Pack Size\s*(.+)/i);
                  if (match) packInfo = match[1].trim();
              } else if (text.length > 0 && text.length < 30 && /\d/.test(text)) {
                packInfo = text;
              }
              if (packInfo) break;
            }

            let price = null;
            const priceMatch = card.textContent.match(/£(\d+\.\d{2})/);
            if (priceMatch) {
              price = parseFloat(priceMatch[1]);
            }

            // FIX 4: Multi-signal stock detection inside card context
            const cardText = card.textContent.toLowerCase();
            const hasOutOfStockText = cardText.includes('out of stock') || cardText.includes('currently unavailable') || cardText.includes('discontinued');
            const hasInStockText = cardText.includes('in stock') || cardText.includes('low stock');

            const allButtons = Array.from(card.querySelectorAll('button'));
            const hasDisabledAddBtn = allButtons.some(b => b.disabled || b.hasAttribute('disabled') || b.classList.contains('disabled'));
            const hasAltProductsBtn = allButtons.some(b => b.textContent.includes('View Alternative Products') || (b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('alternative')));
            const hasEnabledAddBtn = allButtons.some(b => !b.disabled && !b.hasAttribute('disabled') && !b.classList.contains('disabled') && (b.getAttribute('aria-label') && (b.getAttribute('aria-label').toLowerCase().includes('trolley') || b.getAttribute('aria-label').toLowerCase().includes('add'))));
            const hasQuantityInput = card.querySelectorAll('input[type="number"]:not([disabled])').length > 0;

            const isExplicitOOS = hasOutOfStockText || hasAltProductsBtn;
            const isExplicitInStock = hasInStockText;

            const negSignals = (isExplicitOOS ? 1 : 0) + (hasDisabledAddBtn ? 1 : 0);
            const posSignals = (isExplicitInStock ? 1 : 0) + (hasEnabledAddBtn ? 1 : 0) + (hasQuantityInput ? 1 : 0);

            let inStock = null;
            if (negSignals > 0 && posSignals > 0) {
              inStock = null; // Conflicting signals -> UNKNOWN
            } else if (negSignals > 0) {
              inStock = false;
            } else if (posSignals > 0) {
              inStock = true;
            } else {
              inStock = null; // Zero signals -> UNKNOWN (never guess based on price)
            }
            const promo = card.textContent.toLowerCase().includes('promo') || card.textContent.toLowerCase().includes('offer');
            
            let barcode = null;
            const link = card.querySelector('a[href*="/product/"]');
            if (link) {
              const hrefMatch = link.getAttribute('href').match(/\/product\/(\d+)/);
              if (hrefMatch) barcode = hrefMatch[1];
            }

            return {
              rawTitle: title,
              rawPackInfo: packInfo,
              price,
              inStock,
              promotionFlag: promo,
              rawBarcode: barcode
            };
          });
        });
        
        if (items.length === 0) {
           const bodyLower = lowerBody;
           if (bodyLower.match(/(\d+)\s*results?\s*found/)) {
               await this.captureDebugEvidence(pg, term, 'a[href*="/product/"] -> closest(card)', items.length);
           }
        }

        candidates.push(...items.map(i => ({
          ...i,
          rawPackInfo: ProductMetadataParser.sanitizePackInfo(i.rawPackInfo)
        })).filter(i => i.rawTitle));
      }

      return candidates;
    } catch (err) {
      console.error(`[Parfetts] executeSearch failed for ${term}:`, err.message);
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

module.exports = ParfettsScraper;
