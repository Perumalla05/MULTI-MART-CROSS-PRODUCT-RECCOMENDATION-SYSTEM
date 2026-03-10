import AmazonScraper from './amazon.js';

export default class AmazonFreshScraper extends AmazonScraper {
  constructor() {
    super();
    this.platformName = 'Amazon Fresh';
  }

  // Search in Amazon's grocery department
  buildSearchUrl(query, pageNum = 1) {
    const base = `${this.baseUrl}/s?k=${encodeURIComponent(query)}&i=grocery`;
    return pageNum > 1 ? `${base}&page=${pageNum}` : base;
  }

  // Groceries don't have electronics accessories — no filtering needed
  filterAccessories() {
    return false;
  }

  // For groceries, use a looser token match: at least half the tokens must match
  // (product titles often add weight/quantity that the user didn't type)
  titleMatchesTokens(titleNorm, queryTokens) {
    if (queryTokens.length === 0) return true;
    const titleNoSpaces = titleNorm.replace(/\s+/g, '');
    const matched = queryTokens.filter(token => {
      if (titleNorm.includes(token)) return true;
      if (/[a-z]/.test(token) && /[0-9]/.test(token)) {
        return titleNoSpaces.includes(token);
      }
      return false;
    });
    return matched.length >= Math.ceil(queryTokens.length / 2);
  }

  async scrape(query, page) {
    const products = await super.scrape(query, page);
    return products.map(p => ({ ...p, deliveryTime: 'Same day' }));
  }
}
