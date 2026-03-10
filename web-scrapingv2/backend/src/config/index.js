import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    cacheTTL: parseInt(process.env.REDIS_CACHE_TTL) || 900
  },
  
  scraper: {
    timeout: parseInt(process.env.SCRAPER_TIMEOUT) || 180000,
    maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES) || 3,
    concurrentLimit: parseInt(process.env.SCRAPER_CONCURRENT_LIMIT) || 3,
    resultsPerPlatform: parseInt(process.env.SCRAPER_RESULTS_PER_PLATFORM) || 40,
    maxPages: parseInt(process.env.SCRAPER_MAX_PAGES) || 3,
    extractOffersFromProductPage: process.env.EXTRACT_OFFERS_FROM_PRODUCT_PAGE === 'true' || false,
    maxProductPagesToVisit: parseInt(process.env.MAX_PRODUCT_PAGES_TO_VISIT) || 5
  }
};
