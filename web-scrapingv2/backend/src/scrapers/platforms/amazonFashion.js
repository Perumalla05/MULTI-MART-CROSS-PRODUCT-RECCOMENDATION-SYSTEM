import AmazonScraper from './amazon.js';

export default class AmazonFashionScraper extends AmazonScraper {
  constructor() {
    super();
    this.platformName = 'Amazon Fashion';
    this.maxProductPagesToVisit = 5;
  }

  // Search in Amazon's apparel department
  buildSearchUrl(query, pageNum = 1) {
    const base = `${this.baseUrl}/s?k=${encodeURIComponent(query)}&i=apparel`;
    return pageNum > 1 ? `${base}&page=${pageNum}` : base;
  }

  // Fashion accessories (bags, belts, jewelry) are valid products — only filter electronics accessories
  filterAccessories(title) {
    return /\b(tempered|glass|screen\s*protectors?|phone\s*cases?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|dongles?|hubs?|docks?|mouse|keyboard)\b/.test(title.toLowerCase());
  }

  // For fashion, all query tokens should still match (titles are usually specific)
  // but use the same alphanum model-number flexibility from base
}
