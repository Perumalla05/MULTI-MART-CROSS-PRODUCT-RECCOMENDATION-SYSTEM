import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';

export default class InstamartScraper extends BaseScraper {
  constructor() {
    super('Swiggy Instamart');
    this.baseUrl = 'https://www.swiggy.com';
    this.pincode = null; // set by orchestrator before execute()
    this.lat = null;     // GPS coordinates — injected by orchestrator
    this.lng = null;
  }

  // Looser token matching for grocery: at least half the tokens must match
  titleMatchesTokens(titleNorm, queryTokens) {
    if (queryTokens.length === 0) return true;
    const matched = queryTokens.filter(token => titleNorm.includes(token));
    return matched.length >= Math.ceil(queryTokens.length / 2);
  }

  filterAccessories() {
    return false;
  }

  // Attempt to set delivery location using GPS or pincode via Swiggy's location UI
  async setLocation(page) {
    const hasGps = this.lat && this.lng;
    if (!hasGps && !this.pincode) return;

    try {
      // Set browser geolocation first if GPS coords are available
      if (hasGps) {
        await page.context().setGeolocation({ latitude: this.lat, longitude: this.lng });
        await page.context().grantPermissions(['geolocation']);
        logger.info('Swiggy Instamart: Geolocation set', { lat: this.lat, lng: this.lng });
      }

      await page.waitForTimeout(2000);
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Only attempt location entry if the page actually shows a prompt
      if (
        !bodyText.includes('location') &&
        !bodyText.includes('pincode') &&
        !bodyText.includes('deliver')
      ) {
        return;
      }

      // Try clicking "Detect my location" / "Use current location" button if GPS available
      if (hasGps) {
        const detectSelectors = [
          'text=Detect my location',
          'text=Use current location',
          'text=Detect Location',
          '[data-testid*="detect"], [class*="detect-location"], [class*="current-location"]'
        ];
        for (const sel of detectSelectors) {
          const btn = await page.$(sel).catch(() => null);
          if (btn) {
            await btn.click();
            await page.waitForTimeout(2500);
            logger.info('Swiggy Instamart: Clicked GPS detect button');
            return;
          }
        }
      }

      // Fallback: pincode-based location entry
      if (!this.pincode) return;
      logger.info('Swiggy Instamart: Location prompt detected, entering pincode', { pincode: this.pincode });

      const locationSelectors = [
        'input[placeholder*="location"]',
        'input[placeholder*="pincode"]',
        'input[placeholder*="address"]',
        'input[placeholder*="city"]',
        '[data-testid*="location-input"]'
      ];

      for (const selector of locationSelectors) {
        const input = await page.$(selector).catch(() => null);
        if (input) {
          await input.click();
          await input.fill(this.pincode);
          await page.waitForTimeout(1500);

          const suggestion = await page.$(
            '[class*="suggestion"] li, [class*="location-list"] li, [data-testid*="location-suggestion"]'
          ).catch(() => null);
          if (suggestion) {
            await suggestion.click();
          } else {
            await page.keyboard.press('Enter');
          }
          await page.waitForTimeout(2000);
          break;
        }
      }
    } catch (e) {
      logger.warn('Swiggy Instamart: Location setting failed', { error: e.message });
    }
  }

  async scrape(query, page) {
    const hasLocation = this.pincode || (this.lat && this.lng);
    if (!hasLocation) {
      logger.warn('Swiggy Instamart: No location provided — skipping. Provide GPS location or pincode to enable Instamart results.');
      return [];
    }

    const products = [];

    // Navigate to Instamart home first to trigger location setup
    try {
      await page.goto(`${this.baseUrl}/instamart`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.setLocation(page);
    } catch (e) {
      logger.warn('Swiggy Instamart: Homepage navigation failed', { error: e.message });
    }

    // Now navigate to search
    const searchUrl = `${this.baseUrl}/instamart/search?query=${encodeURIComponent(query)}`;
    logger.info('Swiggy Instamart: Navigating to search URL', { url: searchUrl });

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      logger.warn('Swiggy Instamart: Search navigation failed', { error: e.message });
      return [];
    }

    await page.waitForTimeout(4000);

    const pageTitle = await page.title().catch(() => '');
    if (pageTitle.toLowerCase().includes('access denied')) {
      throw new Error(`Swiggy Instamart bot detection: ${pageTitle}`);
    }

    // Wait for product cards
    const productSelector =
      '[class*="Product__"], [class*="product-card"], [data-testid*="product"], [class*="ItemCard"], [class*="PLP__"]';
    try {
      await page.waitForSelector(productSelector, { timeout: 15000 });
    } catch (e) {
      logger.warn('Swiggy Instamart: No products found on search page', { query });
      return [];
    }

    await this.scrollToLoadMore(page, 3);

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    const rawProducts = await page.evaluate(() => {
      const results = [];

      const cardSelectors = [
        '[class*="Product__"]',
        '[class*="product-card"]',
        '[data-testid*="product"]',
        '[class*="ItemCard"]',
        '[class*="PLP__"]'
      ];

      let cards = [];
      for (const sel of cardSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 2) { cards = found; break; }
      }

      for (const card of cards) {
        try {
          // Name — look for prominent text elements
          const nameEl = card.querySelector(
            '[class*="name"], [class*="Name"], [class*="title"], [class*="Title"], h3, p'
          );
          const title = nameEl?.textContent?.trim() || '';
          if (!title || title.length < 3) continue;

          // Price — first ₹ amount
          const allText = card.innerText;
          const priceMatch = allText.match(/₹\s*([\d,]+(?:\.\d+)?)/);
          const priceText = priceMatch ? priceMatch[1].replace(/,/g, '') : '';
          if (!priceText) continue;

          // MRP — strikethrough element
          const mrpEl = card.querySelector('s, del, [class*="mrp"], [class*="MRP"], [class*="original"]');
          const mrpMatch = mrpEl?.textContent?.match(/[\d,]+(?:\.\d+)?/);
          const mrpText = mrpMatch ? mrpMatch[0].replace(/,/g, '') : '';

          // Link
          const linkEl = card.querySelector('a[href]');
          const href = linkEl?.getAttribute('href') || '';

          // Image
          const imgEl = card.querySelector('img');
          const imageUrl = imgEl?.getAttribute('src') || '';

          results.push({ title, priceText, mrpText, href, imageUrl });
        } catch (_) {}
      }

      return results;
    });

    logger.info('Swiggy Instamart: Found raw products', { count: rawProducts.length });

    for (const raw of rawProducts) {
      if (products.length >= this.maxResults) break;

      try {
        const titleNorm = this.normalizeForMatch(raw.title);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;

        const priceNum = Math.round(parseFloat(raw.priceText));
        if (!priceNum || priceNum <= 0) continue;

        const mrpNum = raw.mrpText ? Math.round(parseFloat(raw.mrpText)) : null;
        const href = raw.href.startsWith('http') ? raw.href : `${this.baseUrl}${raw.href}`;

        const product = this.createProduct({
          title: raw.title,
          basePrice: priceNum,
          mrp: mrpNum && mrpNum > priceNum ? mrpNum : null,
          productUrl: href || `${this.baseUrl}/instamart/search?query=${encodeURIComponent(query)}`,
          imageUrl: raw.imageUrl,
          rawOffers: [],
          deliveryTime: '~15 mins'
        });

        if (product.mrp && product.basePrice && product.mrp > product.basePrice) {
          product.discountPercent = Math.round(
            ((product.mrp - product.basePrice) / product.mrp) * 100
          );
        }

        const key = `${product.title}-${product.basePrice}`;
        if (!seenProducts.has(key)) {
          seenProducts.add(key);
          products.push(product);
        }
      } catch (error) {
        logger.warn('Swiggy Instamart: Failed to parse product', { error: error.message });
      }
    }

    logger.info('Swiggy Instamart scrape complete', { query, found: products.length });
    return products;
  }
}
