import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// CROMA SCRAPER
//
// Cloudflare WAF hard-blocks Playwright on www.croma.com (TLS fingerprint).
// Akamai WAF blocks product/allchannels/v1/search for external IPs.
//
// SOLUTION: Use Node.js fetch to call Croma's SAP Hybris Search Service API:
//   GET https://api.croma.com/searchservices/v1/search
//       ?currentPage=0&query={q}%3Arelevance&fields=FULL
//       &channel=WEB&channelCode=400049&spellOpt=DEFAULT&pageSize=24
//
// This endpoint is publicly accessible and returns rich product JSON with
// name, price, mrp, url, plpImage, averageRating, and discountValue.
// ─────────────────────────────────────────────────────────────────────────────

export default class CromaScraper extends BaseScraper {
  constructor() {
    super('Croma');
    this.baseUrl = 'https://www.croma.com';
  }

  filterAccessories(title) {
    return /\b(cases?|covers?|tempered|glass|protectors?|skins?|pouch|sleeves?|holders?|stands?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|straps?|films?|stickers?|rings?|mounts?|grips?|wallets?|folio|bumpers?|stylus|pen|pencil|keyboard|mouse|dongles?|hubs?|docks?)\b/.test(title.toLowerCase());
  }

  buildSearchUrl(query, page = 0) {
    const q = `${encodeURIComponent(query)}%3Arelevance`;
    return `https://api.croma.com/searchservices/v1/search?currentPage=${page}&query=${q}&fields=FULL&channel=WEB&channelCode=400049&spellOpt=DEFAULT&pageSize=24`;
  }

  buildHeaders(query) {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Origin': 'https://www.croma.com',
      'Referer': `https://www.croma.com/searchB?q=${encodeURIComponent(query)}&text=${encodeURIComponent(query)}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site'
    };
  }

  mapCromaProduct(raw) {
    const title = (raw.name || '').trim();
    if (!title || title.length < 5) return null;

    // price and mrp are objects: { value: number, formattedValue: "₹X,XXX" }
    const price = raw.price?.value ?? 0;
    const mrp   = raw.mrp?.value   ?? 0;
    if (!price || price <= 0) return null;

    const path = raw.url || '';
    const productUrl = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const imageUrl = raw.plpImage || raw.thumbnail || '';

    const rating = raw.averageRating ? Math.round(parseFloat(raw.averageRating) * 10) / 10 : null;
    const ratingCount = parseInt(raw.numberOfReviews || raw.numberOfRatings || 0, 10) || null;

    // discountValue is "13%" — parse it
    let discountPercent = null;
    if (typeof raw.discountValue === 'string') {
      const m = raw.discountValue.match(/(\d+)/);
      if (m) discountPercent = parseInt(m[1], 10);
    }
    if (!discountPercent && mrp > price) {
      discountPercent = Math.round(((mrp - price) / mrp) * 100);
    }

    return { title, price, mrp, productUrl, imageUrl, rating, ratingCount, discountPercent };
  }

  async fetchFromSearchAPI(query) {
    const url = this.buildSearchUrl(query);
    logger.info('Croma: Fetching from Search API', { url: url.slice(0, 100) });

    try {
      const resp = await fetch(url, {
        headers: this.buildHeaders(query),
        signal: AbortSignal.timeout(12000)
      });

      if (!resp.ok) {
        logger.warn('Croma: Search API rejected', { status: resp.status, query });
        return null;
      }

      const json = await resp.json();
      if (!Array.isArray(json.products) || json.products.length === 0) {
        logger.info('Croma: Search API returned 0 products', { query });
        return [];
      }

      logger.info('Croma: Search API returned products', { count: json.products.length });
      return json.products;
    } catch (e) {
      logger.warn('Croma: Search API failed', { error: e.message, query });
      return null;
    }
  }

  async scrape(query, page) {
    const products = [];

    logger.info('Croma: Attempting direct Search API fetch', { query });
    const rawProducts = await this.fetchFromSearchAPI(query);

    if (!rawProducts || rawProducts.length === 0) {
      logger.warn('Croma: Search API returned no data', { query });
      return [];
    }

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    for (const raw of rawProducts) {
      if (products.length >= this.maxResults) break;
      try {
        const mapped = this.mapCromaProduct(raw);
        if (!mapped) continue;

        const titleNorm = this.normalizeForMatch(mapped.title);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;
        if (this.filterAccessories(mapped.title)) continue;
        if (mapped.price <= 0) continue;

        const product = this.createProduct({
          title: mapped.title,
          basePrice: mapped.price,
          mrp: mapped.mrp && mapped.mrp > mapped.price ? mapped.mrp : null,
          productUrl: mapped.productUrl,
          imageUrl: mapped.imageUrl,
          rawOffers: [],
          rating: mapped.rating,
          ratingCount: mapped.ratingCount
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
        logger.warn('Croma: Failed to map product', { error: error.message });
      }
    }

    logger.info('Croma scrape complete', { query, found: products.length });
    return products;
  }
}
