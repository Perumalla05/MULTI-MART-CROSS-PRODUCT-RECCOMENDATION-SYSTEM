import browserPool from '../services/browserPool.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

import AmazonScraper from './platforms/amazon.js';
import FlipkartScraper from './platforms/flipkart.js';
import CromaScraper from './platforms/croma.js';
import RelianceDigitalScraper from './platforms/reliancedigital.js';
import MyntraScraper from './platforms/myntra.js';
import AjioScraper from './platforms/ajio.js';
import TataCLiQScraper from './platforms/tatacliq.js';
import AmazonFreshScraper from './platforms/amazonFresh.js';
import FlipkartGroceryScraper from './platforms/flipkartGrocery.js';
import InstamartScraper from './platforms/instamart.js';
import ZeptoScraper from './platforms/zepto.js';
import AmazonFashionScraper from './platforms/amazonFashion.js';
import FlipkartFashionScraper from './platforms/flipkartFashion.js';

// Pre-instantiated scrapers that need pincode injection before each request
const flipkartGroceryScraper = new FlipkartGroceryScraper();
const instamartScraper = new InstamartScraper();
const zeptoScraper = new ZeptoScraper();

const SCRAPERS_BY_CATEGORY = {
  // Electronics: Amazon + Flipkart (established) + Croma + Reliance Digital (physical retail chains)
  electronics: [
    new AmazonScraper(),
    new FlipkartScraper(),
    new CromaScraper(),
    new RelianceDigitalScraper()
  ],
  grocery: [
    new AmazonFreshScraper(),
    flipkartGroceryScraper,
    instamartScraper,
    zeptoScraper
  ],
  // Fashion: Amazon + Flipkart + Myntra + Ajio + Tata CLiQ (fashion/lifestyle marketplace)
  fashion: [
    new AmazonFashionScraper(),
    new FlipkartFashionScraper(),
    new MyntraScraper(),
    new AjioScraper(),
    new TataCLiQScraper()
  ]
};

class ScraperOrchestrator {
  async scrapeAll(query, category = 'electronics', pincode = null, lat = null, lng = null) {
    await browserPool.initialize();

    const scrapers = SCRAPERS_BY_CATEGORY[category] || SCRAPERS_BY_CATEGORY.electronics;

    // Inject location into all location-dependent grocery scrapers
    if (category === 'grocery') {
      flipkartGroceryScraper.pincode = pincode || null;
      instamartScraper.pincode = pincode || null;
      zeptoScraper.pincode = pincode || null;
      // Inject GPS coordinates if provided
      flipkartGroceryScraper.lat = lat;
      flipkartGroceryScraper.lng = lng;
      zeptoScraper.lat = lat;
      zeptoScraper.lng = lng;
      instamartScraper.lat = lat;
      instamartScraper.lng = lng;
    }

    const results = {
      query,
      category,
      timestamp: new Date().toISOString(),
      platforms: {},
      errors: {}
    };

    // Execute scrapers with controlled concurrency
    const limit = config.scraper.concurrentLimit;
    const chunks = this.chunkArray(scrapers, limit);

    for (const chunk of chunks) {
      const promises = chunk.map(async (scraper) => {
        try {
          const context = await browserPool.getContext(scraper.platformName);
          const products = await scraper.execute(query, context);

          results.platforms[scraper.platformName] = {
            success: true,
            count: products.length,
            products
          };

        } catch (error) {
          logger.error('Platform scrape failed', {
            platform: scraper.platformName,
            query,
            error: error.message
          });

          results.platforms[scraper.platformName] = {
            success: false,
            count: 0,
            products: []
          };

          results.errors[scraper.platformName] = error.message;
        }
      });

      await Promise.all(promises);
    }

    // Aggregate all products
    const allProducts = [];
    for (const platform in results.platforms) {
      if (results.platforms[platform].success) {
        allProducts.push(...results.platforms[platform].products);
      }
    }

    results.totalProducts = allProducts.length;
    results.allProducts = allProducts;

    logger.info('Scraping completed', {
      query,
      category,
      totalProducts: allProducts.length,
      successfulPlatforms: Object.keys(results.platforms).filter(
        p => results.platforms[p].success
      ).length
    });

    return results;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async shutdown() {
    await browserPool.shutdown();
  }
}

export default new ScraperOrchestrator();
