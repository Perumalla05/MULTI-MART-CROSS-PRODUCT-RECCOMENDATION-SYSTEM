import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// AJIO SCRAPER
//
// Ajio is a React SPA with hashed CSS class names — DOM scraping is fragile.
//
// SOLUTION: Hit Ajio's Commerce search API directly with Node.js fetch:
//   GET https://www.ajio.com/api/search
//       ?query={q}&start=0&perPage=45&sortBy=relevance&format=json&pageType=search
//
// Returns structured JSON: products[].{ name, fnlColorVariantData.brandName,
//   price.value, wasPriceData.value, discountPercent, url, images[] }
// ─────────────────────────────────────────────────────────────────────────────

export default class AjioScraper extends BaseScraper {
  constructor() {
    super('Ajio');
    this.baseUrl = 'https://www.ajio.com';
  }

  buildApiUrl(query, start = 0, perPage = 45) {
    const q = encodeURIComponent(query);
    return `${this.baseUrl}/api/search?query=${q}&start=${start}&perPage=${perPage}&sortBy=relevance&facets=&format=json&supplierId=&pageType=search`;
  }

  buildHeaders(query) {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Origin': this.baseUrl,
      'Referer': `${this.baseUrl}/search/?text=${encodeURIComponent(query)}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    };
  }

  // Fashion accessories (bags, belts, jewelry) are valid — only filter electronics accessories
  filterAccessories(title) {
    return /\b(tempered|glass|screen\s*protectors?|phone\s*cases?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|dongles?|hubs?|docks?|mouse|keyboard)\b/.test(title.toLowerCase());
  }

  mapAjioProduct(raw) {
    const brand = (raw.fnlColorVariantData?.brandName || '').trim();
    const name = (raw.name || '').trim();
    if (!name || name.length < 3) return null;

    // Build title: "NIKE Court Shot Low-Top Running Shoes"
    const title = brand
      ? (name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`)
      : name;

    // Selling price and MRP
    const price = raw.price?.value ?? 0;
    const mrp   = raw.wasPriceData?.value ?? 0;
    if (!price || price <= 0) return null;

    // Product URL — relative: /nike-court-shot.../p/469755779_white
    const relUrl = raw.url || '';
    const productUrl = relUrl.startsWith('http') ? relUrl : `${this.baseUrl}${relUrl}`;

    // Image — prefer productGrid3ListingImage, fall back to first
    const img = raw.images?.find(i => i.format === 'productGrid3ListingImage') || raw.images?.[0];
    const imageUrl = img?.url || '';

    // Discount — "50% off" → 50
    let discountPercent = null;
    if (typeof raw.discountPercent === 'string') {
      const m = raw.discountPercent.match(/(\d+)/);
      if (m) discountPercent = parseInt(m[1], 10);
    }
    if (!discountPercent && mrp > price) {
      discountPercent = Math.round(((mrp - price) / mrp) * 100);
    }

    return { title, price, mrp, productUrl, imageUrl, discountPercent };
  }

  async fetchFromAjioAPI(query) {
    const url = this.buildApiUrl(query);
    logger.info('Ajio: Fetching from search API', { url: url.slice(0, 120) });

    try {
      const resp = await fetch(url, {
        headers: this.buildHeaders(query),
        signal: AbortSignal.timeout(12000)
      });

      if (!resp.ok) {
        logger.warn('Ajio: API rejected', { status: resp.status, query });
        return null;
      }

      const json = await resp.json();
      if (!Array.isArray(json.products) || json.products.length === 0) {
        logger.info('Ajio: API returned 0 products', { query });
        return [];
      }

      logger.info('Ajio: API returned products', { count: json.products.length });
      return json.products;
    } catch (e) {
      logger.warn('Ajio: API fetch failed', { error: e.message, query });
      return null;
    }
  }

  async scrape(query, page) {
    const products = [];

    logger.info('Ajio: Attempting direct API fetch', { query });
    const items = await this.fetchFromAjioAPI(query);

    if (!items || items.length === 0) {
      logger.warn('Ajio: API returned no data', { query });
      return [];
    }

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    for (const raw of items) {
      if (products.length >= this.maxResults) break;
      try {
        const mapped = this.mapAjioProduct(raw);
        if (!mapped) continue;

        const titleNorm = this.normalizeForMatch(mapped.title);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;
        if (this.filterAccessories(mapped.title)) continue;
        if (!mapped.price || mapped.price <= 0) continue;

        const product = this.createProduct({
          title: mapped.title,
          basePrice: mapped.price,
          mrp: mapped.mrp && mapped.mrp > mapped.price ? mapped.mrp : null,
          productUrl: mapped.productUrl,
          imageUrl: mapped.imageUrl,
          rawOffers: []
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
        logger.warn('Ajio: Failed to map product', { error: error.message });
      }
    }

    logger.info('Ajio scrape complete', { query, found: products.length });
    return products;
  }
}
