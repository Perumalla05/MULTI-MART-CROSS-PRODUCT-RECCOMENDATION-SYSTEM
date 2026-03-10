import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// RELIANCE DIGITAL SCRAPER
//
// Reliance Digital runs on Fynd Commerce (Jio's platform). Their search page
// is a client-side React SPA — products never appear in the initial HTML and
// all DOM selectors return 0 until JavaScript hydrates, which can take 15+ s.
//
// SOLUTION: Bypass Playwright entirely and hit the Fynd Catalog API directly
// with Node.js fetch. This is the same XHR endpoint the browser calls:
//   GET /ext/raven-api/catalog/v1.0/products?f=search_term:{q}:::internal_source:search_prompt&q={q}
//
// The API returns a structured JSON payload with items[], price.effective,
// price.marked, slug, medias[], and _custom_meta (ratings embedded there).
// ─────────────────────────────────────────────────────────────────────────────

export default class RelianceDigitalScraper extends BaseScraper {
  constructor() {
    super('Reliance Digital');
    this.baseUrl = 'https://www.reliancedigital.in';
  }

  buildApiUrl(query, pageSize = 24) {
    const f = encodeURIComponent(`search_term:${query}:::internal_source:search_prompt`);
    const q = encodeURIComponent(query);
    return `${this.baseUrl}/ext/raven-api/catalog/v1.0/products?f=${f}&page_id=%2A&page_size=${pageSize}&q=${q}`;
  }

  buildHeaders(query) {
    const referer = `${this.baseUrl}/products?q=${encodeURIComponent(query)}&page_no=1&page_size=24&page_type=number`;
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Origin': this.baseUrl,
      'Referer': referer,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    };
  }

  filterAccessories(title) {
    return /\b(cases?|covers?|tempered|glass|protectors?|skins?|pouch|sleeves?|holders?|stands?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|dongles?|hubs?|docks?|mouse|keyboard|straps?|films?|stickers?|rings?|mounts?|grips?)\b/.test(title.toLowerCase());
  }

  // Extract rating, ratingCount, and offer tags from the _custom_meta array.
  // _custom_meta entries use key/value pairs:
  //   { key: "averageRating", value: "4.3" }
  //   { key: "Tag1", value: "₹2K Disc + 6M NCEMI HDFC CC*" }
  extractMeta(customMeta) {
    if (!Array.isArray(customMeta)) return { rating: null, ratingCount: null, tag1: '', tag2: '' };
    const find = (key) => customMeta.find(m => m.key === key)?.value || '';
    return {
      rating: parseFloat(find('averageRating')) || null,
      ratingCount: parseInt(find('ratingsCount'), 10) || null,
      tag1: find('Tag1'),
      tag2: find('Tag2')
    };
  }

  // Parse Reliance Digital's condensed promo tag into rawOffer strings.
  // Format examples: "₹2K Disc + 6M NCEMI HDFC CC*"  |  "10% off"
  // The priceEngine's parseOffers() understands specific patterns, so we
  // normalise "₹XK" → "₹X,000" and emit well-formed offer strings.
  parseTagToOffers(tag) {
    if (!tag || tag.trim().toUpperCase() === 'NONE') return [];
    const offers = [];

    // Expand shorthand amounts: "₹2K" → "₹2000", "₹1.5K" → "₹1500"
    const expanded = tag.replace(/₹(\d+(?:\.\d+)?)\s*[Kk]\b/g, (_, n) =>
      `₹${Math.round(parseFloat(n) * 1000)}`
    );

    // No Cost EMI
    if (/ncemi/i.test(tag)) {
      offers.push('No Cost EMI available');
    }

    // Bank / card discount: "₹2000 Disc" or "₹2000 off" with an optional bank name
    const discMatch = expanded.match(/₹([\d,]+)\s*(?:disc(?:ount)?|off)/i);
    if (discMatch) {
      const amount = discMatch[1];
      const bankMatch = tag.match(/\b(HDFC|ICICI|SBI|Axis|Kotak|IDFC|RBL|Yes\s*Bank|BOB|PNB|Canara|Federal|Citi|SC\s*Bank|Standard\s*Chartered)\b/i);
      if (bankMatch) {
        offers.push(`Flat ₹${amount} off on ${bankMatch[1]} Credit Card`);
      } else {
        offers.push(`Extra ₹${amount} off`);
      }
    }

    // Cashback
    const cbMatch = expanded.match(/₹([\d,]+)\s*cashback/i);
    if (cbMatch) {
      offers.push(`Cashback of ₹${cbMatch[1]}`);
    }

    // Exchange offer
    const exMatch = expanded.match(/(?:upto|up\s+to)\s*₹([\d,]+)\s*(?:off\s*on\s*)?exchange/i);
    if (exMatch) {
      offers.push(`Up to ₹${exMatch[1]} off on Exchange`);
    }

    return offers;
  }

  mapFyndProduct(raw) {
    const name = (raw.name || '').trim();
    if (!name || name.length < 5) return null;

    // Fynd price format: { effective: { min, max }, marked: { min, max } }
    const price = raw.price?.effective?.min ?? raw.price?.effective?.max ?? 0;
    const mrp   = raw.price?.marked?.min   ?? raw.price?.marked?.max   ?? 0;
    if (!price || price <= 0) return null;

    // URL — Fynd Commerce product route is /product/{slug}
    const slug = raw.slug || '';
    const href = slug ? `${this.baseUrl}/product/${slug}` : '';

    // Image
    const imageUrl = raw.medias?.[0]?.url || '';

    // Rating + offer tags from _custom_meta
    const { rating, ratingCount, tag1, tag2 } = this.extractMeta(raw._custom_meta);

    // Build rawOffers from promo tags
    const rawOffers = [
      ...this.parseTagToOffers(tag1),
      ...this.parseTagToOffers(tag2)
    ];

    // Discount text → number ("11% OFF" → 11)
    let discountPercent = null;
    if (typeof raw.discount === 'string') {
      const dm = raw.discount.match(/(\d+)\s*%/);
      if (dm) discountPercent = parseInt(dm[1], 10);
    }
    if (!discountPercent && mrp > price) {
      discountPercent = Math.round(((mrp - price) / mrp) * 100);
    }

    return { name, price, mrp, href, imageUrl, rating, ratingCount, discountPercent, rawOffers };
  }

  async fetchFromFyndAPI(query) {
    const url = this.buildApiUrl(query);
    logger.info('Reliance Digital: Fetching from Fynd API', { url: url.slice(0, 120) });

    try {
      const resp = await fetch(url, {
        headers: this.buildHeaders(query),
        signal: AbortSignal.timeout(12000)
      });

      if (!resp.ok) {
        logger.warn('Reliance Digital: API rejected', { status: resp.status });
        return null;
      }

      const json = await resp.json();
      if (!Array.isArray(json.items) || json.items.length === 0) {
        logger.info('Reliance Digital: API returned 0 items', { query });
        return [];
      }

      logger.info('Reliance Digital: API returned items', { count: json.items.length });
      return json.items;
    } catch (e) {
      logger.warn('Reliance Digital: API fetch failed', { error: e.message, query });
      return null;
    }
  }

  async scrape(query, page) {
    const products = [];

    logger.info('Reliance Digital: Attempting direct Fynd API fetch', { query });
    const items = await this.fetchFromFyndAPI(query);

    if (!items || items.length === 0) {
      logger.warn('Reliance Digital: Fynd API returned no data', { query });
      return [];
    }

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    for (const raw of items) {
      if (products.length >= this.maxResults) break;
      try {
        const mapped = this.mapFyndProduct(raw);
        if (!mapped) continue;

        const titleNorm = this.normalizeForMatch(mapped.name);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;
        if (this.filterAccessories(mapped.name)) continue;
        if (!mapped.price || mapped.price <= 0) continue;

        const product = this.createProduct({
          title: mapped.name,
          basePrice: mapped.price,
          mrp: mapped.mrp && mapped.mrp > mapped.price ? mapped.mrp : null,
          productUrl: mapped.href,
          imageUrl: mapped.imageUrl,
          rawOffers: mapped.rawOffers,
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
        logger.warn('Reliance Digital: Failed to map Fynd product', { error: error.message });
      }
    }

    logger.info('Reliance Digital scrape complete', { query, found: products.length });
    return products;
  }
}
