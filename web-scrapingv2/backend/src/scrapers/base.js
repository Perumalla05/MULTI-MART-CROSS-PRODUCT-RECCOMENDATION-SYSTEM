import logger from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';
import config from '../config/index.js';

export default class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.timeout = config.scraper.timeout;
    this.maxResults = config.scraper.resultsPerPlatform;
  }

  // Abstract method - must be implemented by subclasses
  async scrape(query, page) {
    throw new Error(`scrape() must be implemented by ${this.platformName}`);
  }

  // Template method - orchestrates scraping with error handling
  async execute(query, context) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting scrape', { platform: this.platformName, query });
      
      const page = await context.newPage();
      
      const result = await Promise.race([
        this.scrapeWithRetry(query, page),
        this.timeoutPromise()
      ]);
      
      await page.close();
      
      const duration = Date.now() - startTime;
      logger.info('Scrape completed', { 
        platform: this.platformName, 
        query, 
        results: result.length,
        duration 
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Scrape failed', {
        platform: this.platformName,
        query,
        error: error.message,
        stack: error.stack,
        duration
      });
      
      return [];
    }
  }

  async scrapeWithRetry(query, page) {
    return retryWithBackoff(
      () => this.scrape(query, page),
      {
        maxRetries: config.scraper.maxRetries,
        initialDelay: 5000,
        maxDelay: 30000,
        onRetry: (attempt, error) => {
          logger.warn('Scrape retry', {
            platform: this.platformName,
            query,
            attempt,
            error: error.message
          });
        }
      }
    );
  }

  timeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Scrape timeout after ${this.timeout}ms`));
      }, this.timeout);
    });
  }

  // Standardized product schema
  createProduct(data) {
    return {
      source: this.platformName,
      title: data.title || '',
      basePrice: parseFloat(data.basePrice) || 0,
      mrp: data.mrp ? parseFloat(data.mrp) : null,
      discountPercent: data.discountPercent ? parseFloat(data.discountPercent) : null,
      couponDiscount: data.couponDiscount ? parseFloat(data.couponDiscount) : null,
      bankOffer: data.bankOffer ? parseFloat(data.bankOffer) : null,
      shippingCost: data.shippingCost ? parseFloat(data.shippingCost) : null,
      availability: data.availability !== false,
      productUrl: data.productUrl || '',
      imageUrl: data.imageUrl || '',
      rawOffers: data.rawOffers || [],
      rating: data.rating || null,
      ratingCount: data.ratingCount || null,
      deliveryTime: data.deliveryTime || null
    };
  }

  // Scroll down to load lazy-loaded items
  async scrollToLoadMore(page, scrollCount = 5) {
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(800);
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }

  // Strip special chars for fuzzy token matching (e.g. "levi's" → "levis")
  normalizeForMatch(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  }

  // Check if all query tokens appear in the normalized title.
  // For alphanumeric model tokens like "15r", also checks the title with spaces
  // removed so "15 R" (space-separated) still matches.
  titleMatchesTokens(titleNorm, queryTokens) {
    const titleNoSpaces = titleNorm.replace(/\s+/g, '');
    return queryTokens.every(token => {
      if (titleNorm.includes(token)) return true;
      // Model numbers (mix of letters and digits) can appear space-separated
      if (/[a-z]/.test(token) && /[0-9]/.test(token)) {
        return titleNoSpaces.includes(token);
      }
      return false;
    });
  }

  normalizePrice(priceStr) {
    if (!priceStr) return 0;
    return parseFloat(priceStr.toString().replace(/[₹,\s]/g, '')) || 0;
  }
}
