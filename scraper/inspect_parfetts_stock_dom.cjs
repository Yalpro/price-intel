/**
 * Live Parfetts Stock DOM Inspection Script
 *
 * Logins into Parfetts (using ParfettsScraper login flow) and inspects:
 * 1. Product card DOM structure on search result pages
 * 2. Product detail page (PDP) DOM structure
 * 3. Finds buttons, quantity inputs, stock badges, disabled attributes, text content
 */

require('dotenv').config({ path: '../.env' });
const ParfettsScraper = require('./scrapers/parfettsScraper');

async function inspectParfettsStockDom() {
  console.log('=== LIVE PARFETTS STOCK DOM INSPECTION ===\n');

  const scraper = new ParfettsScraper();
  const pg = await scraper.login();

  if (!pg) {
    console.error('Failed to log in to Parfetts.');
    process.exit(1);
  }

  console.log('Authenticated successfully. Inspecting DOM across search terms...\n');

  const searchTerms = ['coca cola', 'bread', 'water', '5000112693577'];

  for (const term of searchTerms) {
    console.log(`\n================ SEARCH TERM: "${term}" ================`);
    const searchUrl = `https://online.parfetts.co.uk/search?q=${encodeURIComponent(term)}`;
    await pg.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(4000);

    const currentUrl = pg.url();
    console.log('Current URL:', currentUrl);

    // Inspect search result cards DOM
    const cardData = await pg.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/product/"]'));
      const cards = links.map(l => l.closest('div.bg-white, li, .border, .shadow, [class*="col-"]')).filter((v,i,a) => v && a.indexOf(v)===i);

      return cards.slice(0, 3).map((card, idx) => {
        const titleEl = card.querySelector('h2, h3, h4, .product-title, [class*="title"], .product-name, div.font-bold');
        const title = titleEl ? titleEl.textContent.trim() : 'NO_TITLE';

        // Find all buttons, inputs, badges, disabled elements inside card
        const buttons = Array.from(card.querySelectorAll('button')).map(b => ({
          text: b.textContent.trim(),
          disabled: b.disabled || b.hasAttribute('disabled') || b.classList.contains('disabled'),
          ariaLabel: b.getAttribute('aria-label'),
          classList: Array.from(b.classList).join('.'),
          type: b.getAttribute('type'),
        }));

        const inputs = Array.from(card.querySelectorAll('input')).map(inp => ({
          type: inp.getAttribute('type'),
          name: inp.getAttribute('name'),
          value: inp.value,
          disabled: inp.disabled || inp.hasAttribute('disabled'),
          classList: Array.from(inp.classList).join('.'),
        }));

        const badges = Array.from(card.querySelectorAll('[class*="stock"], [class*="badge"], [class*="status"], [class*="avail"], p, span, div'))
          .filter(el => {
            const txt = el.textContent.toLowerCase();
            return txt.includes('stock') || txt.includes('out') || txt.includes('avail') || txt.includes('discontinued') || txt.includes('limit');
          })
          .map(el => ({
            tag: el.tagName,
            text: el.textContent.trim(),
            classList: Array.from(el.classList).join('.'),
          }));

        const cardText = card.textContent.replace(/\s+/g, ' ').substring(0, 200);

        return {
          cardIndex: idx,
          title,
          buttons,
          inputs,
          badges,
          cardTextSnippet: cardText,
        };
      });
    });

    console.log(`Found ${cardData.length} sample cards:`);
    console.log(JSON.stringify(cardData, null, 2));

    // If on a PDP or can click to a PDP, inspect PDP
    const firstLink = await pg.locator('a[href*="/product/"]').first();
    if (await firstLink.count() > 0) {
      const href = await firstLink.getAttribute('href');
      console.log(`\n--- Inspecting PDP: ${href} ---`);
      await firstLink.click();
      await pg.waitForTimeout(4000);

      const pdpStockData = await pg.evaluate(() => {
        const h1 = document.querySelector('h1, h2');
        const title = h1 ? h1.textContent.trim() : '';

        const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.textContent.trim(),
          disabled: b.disabled || b.hasAttribute('disabled') || b.classList.contains('disabled'),
          ariaLabel: b.getAttribute('aria-label'),
          classList: Array.from(b.classList).join('.'),
        })).filter(b => b.text.length > 0 || b.ariaLabel);

        const inputs = Array.from(document.querySelectorAll('input')).map(inp => ({
          type: inp.getAttribute('type'),
          disabled: inp.disabled || inp.hasAttribute('disabled'),
          classList: Array.from(inp.classList).join('.'),
        }));

        const stockTexts = Array.from(document.querySelectorAll('*'))
          .filter(el => {
            if (el.children.length > 0) return false; // leaf nodes only
            const txt = el.textContent.toLowerCase().trim();
            return txt.includes('stock') || txt.includes('available') || txt.includes('trolley') || txt.includes('basket') || txt.includes('discontinued');
          })
          .map(el => ({
            tag: el.tagName,
            text: el.textContent.trim(),
            classList: Array.from(el.classList).join('.'),
          }));

        return {
          pdpTitle: title,
          pdpUrl: window.location.href,
          buttons,
          inputs,
          stockTexts,
        };
      });

      console.log('PDP Stock Data:');
      console.log(JSON.stringify(pdpStockData, null, 2));
    }
  }

  await scraper.browser.close();
  console.log('\n=== INSPECTION COMPLETE ===');
}

inspectParfettsStockDom().catch(console.error);
