import express from 'express';
import { validateSearchQuery } from '../middleware/validator.js';
import orchestrator from '../scrapers/orchestrator.js';
import cache from '../services/cache.js';
import database from '../services/database.js';
import { enrichProductWithPrice, findLowestPrices } from '../services/priceEngine.js';
import { groupSimilarProducts } from '../services/productMatcher.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/search', validateSearchQuery, async (req, res, next) => {
  const query = req.validatedQuery;
  const startTime = Date.now();

  const category = req.validatedCategory;
  const pincode = req.validatedPincode;
  const lat = req.validatedLat;
  const lng = req.validatedLng;

  try {
    // Cache key includes category + location (grocery results are location-specific)
    const locationKey = lat && lng ? `${lat.toFixed(3)},${lng.toFixed(3)}` : (pincode || '');
    const cacheKey = locationKey ? `${query}:${category}:${locationKey}` : `${query}:${category}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cached: true,
        responseTime: Date.now() - startTime
      });
    }

    // Scrape platforms for the requested category
    const results = await orchestrator.scrapeAll(query, category, pincode, lat, lng);

    // Enrich with effective prices
    const enrichedProducts = results.allProducts.map(enrichProductWithPrice);

    // Find best deals
    const { lowestBase, lowestEffective } = findLowestPrices(enrichedProducts);

    // Group similar products
    const groups = groupSimilarProducts(enrichedProducts);

    const response = {
      query,
      timestamp: results.timestamp,
      totalProducts: results.totalProducts,
      platforms: results.platforms,
      errors: results.errors,
      products: enrichedProducts,
      groups,
      bestDeals: {
        lowestBasePrice: lowestBase,
        lowestEffectivePrice: lowestEffective
      },
      cached: false,
      responseTime: Date.now() - startTime
    };

    // Cache results (keyed by query + category + pincode)
    await cache.set(cacheKey, response);

    // Log to database (async, don't wait)
    database.logSearch(query, results, Date.now() - startTime)
      .then(searchId => {
        if (searchId) {
          database.logProducts(searchId, enrichedProducts);
        }
      })
      .catch(err => logger.error('Failed to log to database', { error: err.message }));

    res.json(response);

  } catch (error) {
    next(error);
  }
});

export default router;
