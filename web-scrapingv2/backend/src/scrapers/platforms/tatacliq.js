import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// TATA CLiQ SCRAPER
//
// Tata CLiQ is a React SPA with hashed CSS class names — DOM scraping is fragile.
//
// SOLUTION: Hit the Tata CLiQ Search BFF API directly with Node.js fetch:
//   GET https://searchbff.tatacliq.com/products/mpl/search
//       ?searchText={q}:relevance:inStockFlag:true&channel=WEB&page=0&pageSize=40
//
// Returns JSON with searchresult[].{ productname, brandname, price.sellingPrice,
//   price.mrpPrice, discountPercent, webURL, imageURL, averageRating, ratingCount }
// ─────────────────────────────────────────────────────────────────────────────

export default class TataCLiQScraper extends BaseScraper {
  constructor() {
    super('Tata CLiQ');
    this.baseUrl = 'https://www.tatacliq.com';
    this.searchApiBase = 'https://searchbff.tatacliq.com';
  }

  buildApiUrl(query, page = 0, pageSize = 40) {
    // searchText format: {query}:relevance:inStockFlag:true
    const searchText = encodeURIComponent(`${query}:relevance:inStockFlag:true`);
    return `${this.searchApiBase}/products/mpl/search?searchText=${searchText}&isKeywordRedirect=false&isKeywordRedirectEnabled=true&channel=WEB&isMDE=true&isTextSearch=false&isFilter=false&qc=false&page=${page}&customerId=&isSuggested=false&isFilterDataRequired=true&isPwa=true&pageSize=${pageSize}&typeID=all`;
  }

  buildHeaders(query) {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Origin': this.baseUrl,
      'Referer': `${this.baseUrl}/search/?searchCategory=all&text=${encodeURIComponent(query)}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site'
    };
  }

  // Fashion accessories (bags, belts, jewelry) are valid — only filter electronics accessories
  filterAccessories(title) {
    return /\b(tempered|glass|screen\s*protectors?|phone\s*cases?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|dongles?|hubs?|docks?|mouse|keyboard)\b/.test(title.toLowerCase());
  }

  mapTataCliqProduct(raw) {
    const name = (raw.productname || raw.productTitle || '').trim();
    if (!name || name.length < 5) return null;

    const price = raw.price?.sellingPrice?.doubleValue ?? 0;
    const mrp   = raw.price?.mrpPrice?.doubleValue ?? 0;
    if (!price || price <= 0) return null;

    if (raw.inStockFlag === false) return null;

    // URL — relative: /nike-womens.../p-mp000000030072090
    const relUrl = raw.webURL || '';
    const productUrl = relUrl.startsWith('http') ? relUrl : `${this.baseUrl}${relUrl}`;

    // Image — protocol-relative: "//img.tatacliq.com/..."
    const imgRaw = raw.imageURL || raw.productImages?.[0] || '';
    const imageUrl = imgRaw.startsWith('//') ? `https:${imgRaw}` : imgRaw;

    // Rating
    const rating = raw.averageRating ? Math.round(parseFloat(raw.averageRating) * 10) / 10 : null;
    const ratingCount = parseInt(raw.ratingCount || 0, 10) || null;

    // discountPercent is a string like "0" or "25" — "0" even when discount exists via price diff
    let discountPercent = null;
    if (typeof raw.discountPercent === 'string') {
      const d = parseInt(raw.discountPercent, 10);
      if (d > 0) discountPercent = d;
    }
    if (!discountPercent && mrp > price) {
      discountPercent = Math.round(((mrp - price) / mrp) * 100);
    }

    return { name, price, mrp, productUrl, imageUrl, rating, ratingCount, discountPercent };
  }

  async fetchFromSearchAPI(query) {
    const url = this.buildApiUrl(query);
    logger.info('Tata CLiQ: Fetching from search BFF API', { url: url.slice(0, 120) });

    try {
      const resp = await fetch(url, {
        headers: this.buildHeaders(query),
        signal: AbortSignal.timeout(12000)
      });

      if (!resp.ok) {
        logger.warn('Tata CLiQ: API rejected', { status: resp.status, query });
        return null;
      }

      const json = await resp.json();
      if (!Array.isArray(json.searchresult) || json.searchresult.length === 0) {
        logger.info('Tata CLiQ: API returned 0 results', { query });
        return [];
      }

      logger.info('Tata CLiQ: API returned results', { count: json.searchresult.length });
      return json.searchresult;
    } catch (e) {
      logger.warn('Tata CLiQ: API fetch failed', { error: e.message, query });
      return null;
    }
  }

  async scrape(query, page) {
    const products = [];

    logger.info('Tata CLiQ: Attempting direct search BFF API fetch', { query });
    const items = await this.fetchFromSearchAPI(query);

    if (!items || items.length === 0) {
      logger.warn('Tata CLiQ: API returned no data', { query });
      return [];
    }

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    for (const raw of items) {
      if (products.length >= this.maxResults) break;
      try {
        const mapped = this.mapTataCliqProduct(raw);
        if (!mapped) continue;

        const titleNorm = this.normalizeForMatch(mapped.name);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;
        if (this.filterAccessories(mapped.name)) continue;
        if (!mapped.price || mapped.price <= 0) continue;

        const product = this.createProduct({
          title: mapped.name,
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
        logger.warn('Tata CLiQ: Failed to map product', { error: error.message });
      }
    }

    logger.info('Tata CLiQ scrape complete', { query, found: products.length });
    return products;
  }
}
