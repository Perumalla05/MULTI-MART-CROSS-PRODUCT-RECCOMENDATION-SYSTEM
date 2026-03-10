import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// ZEPTO SCRAPER
//
// Zepto is a React SPA (zepto.com) with location-aware product listings.
// The app loads with a default location (Bangalore) even without pincode set.
//
// SOLUTION: Navigate to the search page via Playwright and passively intercept
// the BFF search API response:
//   https://bff-gateway.zepto.com/user-search-service/api/v3/search
//
// Response structure: layout[] → widgetId=PRODUCT_GRID → data.resolver.data.items[]
//   → productResponse.{ product.name, discountedSellingPrice (paise),
//     mrp (paise), discountPercent, productVariant.images[], ratingSummary }
//
// Prices are in PAISE — divide by 100 to get rupees.
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_CDN = 'https://cdn.zeptonow.com/production///tr:w-500,ar-3-4/';

export default class ZeptoScraper extends BaseScraper {
  constructor() {
    super('Zepto');
    this.baseUrl = 'https://www.zepto.com';
    this.pincode = null; // injected by orchestrator (optional)
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
    return false; // No accessory filter for grocery
  }

  mapZeptoProduct(pr) {
    // pr = productResponse object from BFF API
    const name = (pr.product?.name || '').trim();
    if (!name || name.length < 3) return null;

    // Prices are in PAISE → convert to rupees
    const price = pr.discountedSellingPrice != null ? Math.round(pr.discountedSellingPrice / 100) : 0;
    const mrp   = pr.mrp != null ? Math.round(pr.mrp / 100) : 0;
    if (!price || price <= 0) return null;

    if (pr.outOfStock === true) return null;

    const discountPercent = typeof pr.discountPercent === 'number' ? pr.discountPercent : null;

    // Image — CDN path from productVariant.images[0].path
    const imgPath = pr.productVariant?.images?.[0]?.path || '';
    const imageUrl = imgPath ? `${IMAGE_CDN}${imgPath}` : '';

    // Rating
    const rating = pr.productVariant?.ratingSummary?.averageRating
      ? Math.round(parseFloat(pr.productVariant.ratingSummary.averageRating) * 10) / 10
      : null;
    const ratingCount = pr.productVariant?.ratingSummary?.totalRatings
      ? parseInt(pr.productVariant.ratingSummary.totalRatings, 10)
      : null;

    // Product URL — /pn/{slug}/pvid/{variantId}
    const variantId = pr.productVariant?.id || pr.id || '';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const productUrl = variantId
      ? `${this.baseUrl}/pn/${slug}/pvid/${variantId}`
      : `${this.baseUrl}/search?query=${encodeURIComponent(name)}`;

    return { name, price, mrp, discountPercent, imageUrl, rating, ratingCount, productUrl };
  }

  extractProductsFromLayout(layout) {
    const products = [];
    if (!Array.isArray(layout)) return products;

    for (const widget of layout) {
      if (widget.widgetId !== 'PRODUCT_GRID' && !widget.widgetName?.includes('SEARCHED_PRODUCTS')) continue;
      const items = widget?.data?.resolver?.data?.items || [];
      for (const item of items) {
        if (item.productResponse) products.push(item.productResponse);
      }
    }
    return products;
  }

  async scrape(query, page) {
    const products = [];

    let bffData = null;

    // Set geolocation if GPS coordinates were provided by the user
    if (this.lat && this.lng) {
      try {
        await page.context().setGeolocation({ latitude: this.lat, longitude: this.lng });
        await page.context().grantPermissions(['geolocation']);
        logger.info('Zepto: Geolocation set', { lat: this.lat, lng: this.lng });
      } catch (e) {
        logger.warn('Zepto: Failed to set geolocation', { error: e.message });
      }
    }

    // Intercept BFF search API response
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('user-search-service') && url.includes('search') && !url.includes('filter')) {
        try {
          bffData = await response.json();
        } catch (_) {}
      }
    });

    const searchUrl = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
    logger.info('Zepto: Navigating to search page', { url: searchUrl });

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      logger.warn('Zepto: Navigation failed', { error: e.message, query });
      return [];
    }

    // Wait for BFF response (up to 8s)
    const deadline = Date.now() + 8000;
    while (!bffData && Date.now() < deadline) {
      await page.waitForTimeout(400);
    }

    if (!bffData) {
      logger.warn('Zepto: BFF search API not captured', { query });
      return [];
    }

    logger.info('Zepto: BFF API captured', {
      totalProductCount: bffData.totalProductCount,
      query
    });

    const rawProductResponses = this.extractProductsFromLayout(bffData.layout);
    logger.info('Zepto: Extracted product responses', { count: rawProductResponses.length });

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    for (const pr of rawProductResponses) {
      if (products.length >= this.maxResults) break;
      try {
        const mapped = this.mapZeptoProduct(pr);
        if (!mapped) continue;

        const titleNorm = this.normalizeForMatch(mapped.name);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;
        if (!mapped.price || mapped.price <= 0) continue;

        const product = this.createProduct({
          title: mapped.name,
          basePrice: mapped.price,
          mrp: mapped.mrp && mapped.mrp > mapped.price ? mapped.mrp : null,
          productUrl: mapped.productUrl,
          imageUrl: mapped.imageUrl,
          rawOffers: [],
          rating: mapped.rating,
          ratingCount: mapped.ratingCount,
          deliveryTime: '~10 mins'
        });

        if (mapped.discountPercent) {
          product.discountPercent = mapped.discountPercent;
        } else if (product.mrp && product.basePrice && product.mrp > product.basePrice) {
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
        logger.warn('Zepto: Failed to map product', { error: error.message });
      }
    }

    logger.info('Zepto scrape complete', { query, found: products.length });
    return products;
  }
}
