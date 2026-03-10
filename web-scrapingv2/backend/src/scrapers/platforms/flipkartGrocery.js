import FlipkartScraper from './flipkart.js';
import logger from '../../utils/logger.js';

export default class FlipkartGroceryScraper extends FlipkartScraper {
  constructor() {
    super();
    this.platformName = 'Flipkart Minutes';
    this.pincode = null; // set by orchestrator before execute()
    this.lat = null;     // GPS coordinates — injected by orchestrator
    this.lng = null;
  }

  buildSearchUrl(query, pageNum = 1) {
    const base = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&marketplace=GROCERY&otracker=search`;
    return pageNum > 1 ? `${base}&page=${pageNum}` : base;
  }

  filterAccessories() {
    return false;
  }

  // Looser token matching for grocery: at least half the tokens must match
  titleMatchesTokens(titleNorm, queryTokens) {
    if (queryTokens.length === 0) return true;
    const titleNoSpaces = titleNorm.replace(/\s+/g, '');
    const matched = queryTokens.filter(token => {
      if (titleNorm.includes(token)) return true;
      if (/[a-z]/.test(token) && /[0-9]/.test(token)) {
        return titleNoSpaces.includes(token);
      }
      return false;
    });
    return matched.length >= Math.ceil(queryTokens.length / 2);
  }

  // Resolve a 6-digit Indian pincode from GPS coordinates via Nominatim
  async resolveGpsToPincode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const resp = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'PriceCompareTool/1.0' }
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const postcode = data.address?.postcode;
      // Indian pincodes are exactly 6 digits
      return postcode && /^\d{6}$/.test(postcode) ? postcode : null;
    } catch {
      return null;
    }
  }

  // Hook: called right after page.goto() on the search page
  async onPageLoad(page) {
    const hasGps = this.lat && this.lng;
    if (!hasGps && !this.pincode) return;

    // Determine effective pincode: prefer explicit pincode, fall back to GPS reverse-geocoded one
    let effectivePincode = this.pincode;
    if (hasGps && !effectivePincode) {
      effectivePincode = await this.resolveGpsToPincode(this.lat, this.lng);
      if (effectivePincode) {
        logger.info('Flipkart Minutes: Resolved pincode from GPS', { pincode: effectivePincode });
      } else {
        logger.warn('Flipkart Minutes: Could not resolve pincode from GPS — skipping location setup');
        return;
      }
    }

    // Wait for client-side redirects to settle
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (e) {
      // Heavy pages may not reach networkidle — proceed anyway
    }

    try {
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());

      const hasLocationPrompt =
        bodyText.includes('pincode') ||
        bodyText.includes('pin code') ||
        bodyText.includes('verify delivery') ||
        bodyText.includes('delivery location') ||
        bodyText.includes('enter location') ||
        bodyText.includes('check delivery') ||
        bodyText.includes('please enter pincode');

      if (!hasLocationPrompt) return;

      logger.info('Flipkart Minutes: Location prompt detected, entering pincode', { pincode: effectivePincode });

      const inputSelector =
        'input[placeholder*="incode"], input[placeholder*="nter pincode"], input[type="tel"], input[type="number"]';
      const input = await page.$(inputSelector).catch(() => null);

      if (!input) {
        logger.warn('Flipkart Minutes: Could not find pincode input — trying keyboard approach');
        await page.keyboard.type(effectivePincode);
        await page.keyboard.press('Enter');
      } else {
        await input.click();
        await input.fill(effectivePincode);
        await page.keyboard.press('Enter');
      }

      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      logger.info('Flipkart Minutes: Pincode submitted, page reloading with products');
    } catch (e) {
      logger.warn('Flipkart Minutes: Location handling failed', { error: e.message });
    }
  }

  async scrape(query, page) {
    const products = await super.scrape(query, page);
    return products.map(p => ({ ...p, deliveryTime: '~15 mins' }));
  }
}
