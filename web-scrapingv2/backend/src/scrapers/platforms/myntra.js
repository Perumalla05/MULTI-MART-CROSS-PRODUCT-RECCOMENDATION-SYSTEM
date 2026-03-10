import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';

export default class MyntraScraper extends BaseScraper {
  constructor() {
    super('Myntra');
    this.baseUrl = 'https://www.myntra.com';
  }

  buildSearchUrl(query) {
    // Myntra search URL: /{hyphenated-query}?rawQuery={query}
    const slug = query.toLowerCase().replace(/\s+/g, '-');
    return `${this.baseUrl}/${slug}?rawQuery=${encodeURIComponent(query)}`;
  }

  // Fashion accessories (bags, belts, jewelry) are valid — only filter electronics accessories
  filterAccessories(title) {
    return /\b(tempered|glass|screen\s*protectors?|phone\s*cases?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|dongles?|hubs?|docks?|mouse|keyboard)\b/.test(title.toLowerCase());
  }

  async scrape(query, page) {
    const products = [];

    const searchUrl = this.buildSearchUrl(query);
    logger.info('Myntra: Navigating to search URL', { url: searchUrl });

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      // ERR_HTTP2_PROTOCOL_ERROR or navigation timeout — throw so retry kicks in
      logger.warn('Myntra: Navigation failed', { error: e.message, query });
      if (e.message.includes('ERR_HTTP2') || e.message.includes('ERR_HTTP') || e.message.includes('net::')) {
        throw new Error(`Myntra navigation error: ${e.message}`);
      }
      return [];
    }

    await page.waitForTimeout(3000);

    // Detect bot-block / captcha pages
    const pageTitle = await page.title().catch(() => '');
    const currentUrl = page.url();
    if (
      pageTitle.toLowerCase().includes('access denied') ||
      currentUrl.includes('captcha')
    ) {
      logger.warn('Myntra: Bot detection triggered', { title: pageTitle, url: currentUrl });
      throw new Error(`Myntra bot detection: ${pageTitle}`);
    }

    // Wait for the product listing container
    try {
      await page.waitForSelector('.results-base, li.product-base', { timeout: 15000 });
    } catch (e) {
      logger.warn('Myntra: Products not found on page', { query, url: page.url() });
      return [];
    }

    await page.waitForTimeout(1000);
    await this.scrollToLoadMore(page, 5);

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    // Extract all products in a single evaluate call
    const rawProducts = await page.evaluate(() => {
      const results = [];
      const items = document.querySelectorAll('li.product-base');

      for (const item of items) {
        try {
          const brand = item.querySelector('.product-brand')?.textContent?.trim() || '';
          const name = item.querySelector('.product-product')?.textContent?.trim() || '';
          const title = brand && name ? `${brand} ${name}` : (brand || name);
          if (!title || title.length < 5) continue;

          const priceEl = item.querySelector('.product-discountedPrice');
          const mrpEl = item.querySelector('.product-strike');
          const priceText = priceEl?.textContent?.replace(/[₹,\s]/g, '') || '';
          const mrpText = mrpEl?.textContent?.replace(/[₹,\s]/g, '') || '';
          if (!priceText || !priceText.match(/\d+/)) continue;

          const linkEl = item.querySelector('a[href]');
          const href = linkEl?.getAttribute('href') || '';

          const imgEl = item.querySelector('img');
          const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

          // Discount % from listing (e.g. "(50% OFF)")
          const discountEl = item.querySelector('.product-discountPercentage');
          const discountText = discountEl?.textContent?.trim() || '';

          // Rating — e.g. "4.3" and "(1,234)" or "4.3 | 1234 Ratings"
          const ratingEl = item.querySelector('[class*="rating-count"], [class*="ratingsCount"], [class*="product-rating"]');
          const ratingText = ratingEl?.textContent?.trim() || '';

          results.push({ title, priceText, mrpText, href, imageUrl, discountText, ratingText });
        } catch (_) {}
      }

      return results;
    });

    logger.info('Myntra: Found raw products', { count: rawProducts.length });

    for (const raw of rawProducts) {
      if (products.length >= this.maxResults) break;

      try {
        const titleNorm = this.normalizeForMatch(raw.title);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;
        if (this.filterAccessories(raw.title)) continue;

        const priceNum = parseInt(raw.priceText.replace(/[^\d]/g, ''), 10);
        if (!priceNum) continue;

        const mrpNum = raw.mrpText ? parseInt(raw.mrpText.replace(/[^\d]/g, ''), 10) : null;

        // Myntra links are relative: /brand/product/buy
        const href = raw.href.startsWith('http') ? raw.href : `${this.baseUrl}/${raw.href.replace(/^\//, '')}`;

        // Parse rating from text like "4.3 | 1,234 Ratings" or "(4.3)" + "(1,234)"
        let rating = null;
        let ratingCount = null;
        if (raw.ratingText) {
          const rVal = raw.ratingText.match(/(\d+\.\d+)/);
          const rCnt = raw.ratingText.match(/([\d,]+)\s*Ratings?/i);
          if (rVal) rating = parseFloat(rVal[1]);
          if (rCnt) ratingCount = parseInt(rCnt[1].replace(/,/g, ''), 10);
        }

        const product = this.createProduct({
          title: raw.title,
          basePrice: priceNum,
          mrp: mrpNum && mrpNum > priceNum ? mrpNum : null,
          productUrl: href,
          imageUrl: raw.imageUrl,
          rawOffers: [],
          rating,
          ratingCount
        });

        if (product.mrp && product.basePrice && product.mrp > product.basePrice) {
          product.discountPercent = Math.round(
            ((product.mrp - product.basePrice) / product.mrp) * 100
          );
        }

        // Fallback: parse discount % from listing text "(50% OFF)"
        if (!product.discountPercent && raw.discountText) {
          const dm = raw.discountText.match(/(\d+)\s*%/);
          if (dm) product.discountPercent = parseInt(dm[1], 10);
        }

        const key = `${product.title}-${product.basePrice}`;
        if (!seenProducts.has(key)) {
          seenProducts.add(key);
          products.push(product);
        }
      } catch (error) {
        logger.warn('Myntra: Failed to parse product', { error: error.message });
      }
    }

    logger.info('Myntra scrape complete', { query, found: products.length });
    return products;
  }
}
