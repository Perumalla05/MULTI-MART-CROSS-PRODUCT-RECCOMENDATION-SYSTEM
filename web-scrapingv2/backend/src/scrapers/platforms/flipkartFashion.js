import FlipkartScraper from './flipkart.js';

export default class FlipkartFashionScraper extends FlipkartScraper {
  constructor() {
    super();
    this.platformName = 'Flipkart Fashion';
    // Visit all scraped fashion products — concurrent fetches (3 at a time) keep this within timeout.
    // ceil(20/3) = 7 batches × 15s max = 105s + search, well under 180s.
    this.maxProductPagesToVisit = 20;
  }

  // Search in Flipkart's fashion marketplace
  buildSearchUrl(query, pageNum = 1) {
    const base = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&otracker=search&marketplace=FASHION`;
    return pageNum > 1 ? `${base}&page=${pageNum}` : base;
  }

  // Fashion accessories (bags, belts, jewelry) are valid — only filter electronics accessories
  filterAccessories(title) {
    return /\b(tempered|glass|screen\s*protectors?|phone\s*cases?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|dongles?|hubs?|docks?|mouse|keyboard)\b/.test(title.toLowerCase());
  }
}
