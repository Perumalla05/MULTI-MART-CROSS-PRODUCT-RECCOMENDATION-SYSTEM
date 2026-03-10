import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

export default class FlipkartScraper extends BaseScraper {
  constructor() {
    super('Flipkart');
    this.baseUrl = 'https://www.flipkart.com';
    // Visit up to 15 product pages (concurrent visits make this fast enough).
    this.maxProductPagesToVisit = 15;
    // Open 3 product pages in parallel within the same browser context.
    // ceil(15/3) = 5 batches × 15s max = 75s + search — well under 180s.
    this.concurrentPageVisits = 3;
  }

  async extractOffersFromProductPage(page, productUrl) {
    try {
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      const offers = [];
      const seenOffers = new Set();
      const bodyText = await page.evaluate(() => document.body.innerText);
      const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // --- Coupons section (appears before Bank offers) ---
      // Pattern: "Coupons" → "₹X off" → "coupon description"
      // Only keep the first (best) coupon to avoid duplicates
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === 'coupons' && i + 1 < lines.length) {
          const amountLine = lines[i + 1];
          if (/₹[\d,]+\s*off/i.test(amountLine)) {
            const desc = i + 2 < lines.length ? lines[i + 2] : '';
            const offerText = desc.toLowerCase().includes('coupon')
              ? `Coupon: ${amountLine} - ${desc}`
              : `Coupon: ${amountLine}`;
            if (!seenOffers.has(offerText)) {
              seenOffers.add(offerText);
              offers.push(offerText);
            }
            break; // Only keep first coupon offer
          }
        }
      }

      // --- No Cost EMI (check early so it's not cut off by limit) ---
      for (const line of lines) {
        if (line.toLowerCase().includes('no cost emi') && !seenOffers.has('No Cost EMI available')) {
          seenOffers.add('No Cost EMI available');
          offers.push('No Cost EMI available');
          break;
        }
      }

      // --- Bank offers section ---
      // Pattern: [bank name] → [type e.g. "Credit Card • Cashback"] → "₹X off" → "Apply"
      // Only keep best offer per payment type (credit card, debit card, UPI)
      let inBankOffers = false;
      let lineCount = 0;
      const bestByType = {}; // { 'credit card': { amount, text }, 'debit card': ..., 'upi': ... }

      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();

        if (lower === 'bank offers') {
          inBankOffers = true;
          lineCount = 0;
          continue;
        }

        if (inBankOffers) {
          lineCount++;
          if (lineCount > 60 || lower.includes('delivery') || lower.includes('highlights') ||
              lower.includes('specification') || lower === 'emi') {
            inBankOffers = false;
            continue;
          }

          const amountMatch = lines[i].match(/^₹([\d,]+)\s*off$/i);
          if (amountMatch) {
            const amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);

            let offerType = '';
            let paymentType = 'bank';
            for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
              const prev = lines[j].toLowerCase();
              if (prev.includes('credit card') || prev.includes('debit card') ||
                  prev.includes('upi') || prev.includes('cashback') ||
                  prev.includes('net banking')) {
                offerType = lines[j];
                if (prev.includes('credit card')) paymentType = 'credit card';
                else if (prev.includes('debit card')) paymentType = 'debit card';
                else if (prev.includes('upi')) paymentType = 'upi';
                // Grab bank name
                if (j > 0 && !['apply', 'best value for you'].includes(lines[j-1].toLowerCase()) &&
                    lines[j-1].length < 40 && lines[j-1].length > 2) {
                  offerType = `${lines[j-1]} ${offerType}`;
                }
                break;
              }
            }

            const offerText = offerType
              ? `${offerType} - ${lines[i]}`
              : `Bank offer - ${lines[i]}`;

            if (!bestByType[paymentType] || amount > bestByType[paymentType].amount) {
              bestByType[paymentType] = { amount, text: offerText };
            }
          }
        }
      }

      // Add only the best offer per payment type
      for (const entry of Object.values(bestByType)) {
        if (!seenOffers.has(entry.text)) {
          seenOffers.add(entry.text);
          offers.push(entry.text);
        }
      }

      // --- Exchange offer (look for "exchange" with ₹ amount) ---
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('exchange') && lines[i].includes('₹') && lines[i].length < 150) {
          if (!seenOffers.has(lines[i])) {
            seenOffers.add(lines[i]);
            offers.push(lines[i]);
          }
        }
        // Also: "Exchange" header followed by "Up to ₹X off"
        if (lower === 'exchange' || lower.includes('exchange offer')) {
          if (i + 1 < lines.length && /₹[\d,]+/.test(lines[i + 1])) {
            const offerText = `Exchange: ${lines[i + 1]}`;
            if (!seenOffers.has(offerText)) {
              seenOffers.add(offerText);
              offers.push(offerText);
            }
          }
        }
      }

      return offers.slice(0, 10);
    } catch (error) {
      logger.warn('Failed to extract offers from Flipkart product page', { url: productUrl, error: error.message });
      return [];
    }
  }

  // Extract products from current page
  async extractPageItems(page, queryTokens, seenProducts, maxCount) {
    const products = [];
    const items = await page.$$('[data-id]');

    for (let i = 0; i < items.length && products.length < maxCount; i++) {
      try {
        const item = items[i];

        // Title: try img alt first, fall back to link text (fashion items have empty alt)
        const imgEl = await item.$('img');
        let title = imgEl ? await imgEl.getAttribute('alt') : null;

        if (!title || title.trim().length < 5) {
          const titleData = await item.evaluate(node => {
            const links = node.querySelectorAll('a[href*="/p/"]');
            let brand = '';
            let productTitle = '';
            const textNodes = node.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (textNodes.length > 0) brand = textNodes[0];
            for (const link of links) {
              const text = link.textContent?.trim();
              if (text && text.length > 5 && !text.includes('₹') && !/^\d+%/.test(text)) {
                productTitle = text;
                break;
              }
            }
            return { brand, productTitle };
          });

          if (titleData.productTitle) {
            title = titleData.productTitle;
            if (titleData.brand && !title.toLowerCase().startsWith(titleData.brand.toLowerCase())) {
              title = `${titleData.brand} ${title}`;
            }
          }
        }

        if (!title || title.trim().length < 5) continue;

        const titleNorm = this.normalizeForMatch(title);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;

        // Skip accessories (overridable in subclasses)
        if (this.filterAccessories(title)) continue;

        const text = await item.evaluate(node => node.innerText);
        const textLines = text.split('\n').map(l => l.trim());
        const priceLines = textLines.filter(l => l.includes('₹'));

        let basePrice = null;
        let mrp = null;

        if (priceLines.length > 0) {
          const priceLine = priceLines[0];
          const prices = priceLine.match(/₹([\d,]+)/g);
          if (prices && prices.length >= 1) {
            basePrice = prices[0].replace('₹', '');
            if (prices.length >= 2) mrp = prices[1].replace('₹', '');
          }
        }
        if (!basePrice) continue;

        // Offers from listing — include lines with amounts (e.g. "Up to ₹71,000 off on exchange")
        const offers = [];
        const seenOfferLines = new Set();
        textLines.forEach(line => {
          const lower = line.toLowerCase();
          if (line.length < 5 || line.length > 150) return;
          // Bare price lines like "₹45,990" are not offers
          if (/^₹[\d,]+$/.test(line.trim())) return;
          const hasOfferKeyword =
            lower.includes('bank offer') || lower.includes('no cost emi') ||
            lower.includes('exchange') || lower.includes('cashback') ||
            lower.includes('instant discount') || lower.includes('coupon') ||
            lower.includes('upi') ||
            (lower.includes('up to') && lower.includes('off')) ||
            (lower.includes('extra') && lower.includes('off')) ||
            (lower.includes('flat') && lower.includes('off'));
          if (hasOfferKeyword && !seenOfferLines.has(line)) {
            seenOfferLines.add(line);
            offers.push(line);
          }
        });

        const linkEl = await item.$('a');
        const rawHref = linkEl ? await linkEl.getAttribute('href') : null;
        const href = rawHref ? this.cleanProductUrl(rawHref.startsWith('http') ? rawHref : `${this.baseUrl}${rawHref}`) : null;
        const imageUrl = imgEl ? await imgEl.getAttribute('src') : null;

        // Rating — try DOM selectors first, then fall back to textLines parsing
        let rating = null;
        let ratingCount = null;

        // Flipkart concatenates rating value and count with no separator:
        // e.g. "4.75,286 Ratings & 283 Reviews" = "4.7" + "5,286 Ratings..."
        // Regex: ^(\d+\.\d) captures the rating (1 decimal), (\d[\d,]*) captures the count.
        for (const line of textLines) {
          const m = line.match(/^(\d+\.\d)(\d[\d,]*)\s*Ratings?/i);
          if (m) {
            rating = parseFloat(m[1]);
            ratingCount = parseInt(m[2].replace(/,/g, ''), 10);
            break;
          }
        }

        const product = this.createProduct({
          title,
          basePrice: this.normalizePrice(basePrice),
          mrp: mrp ? this.normalizePrice(mrp) : null,
          productUrl: href || '',
          imageUrl: imageUrl || '',
          rawOffers: offers,
          rating,
          ratingCount
        });

        if (product.mrp && product.basePrice && product.mrp > product.basePrice) {
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
        logger.warn('Failed to parse Flipkart product', { index: i, error: error.message });
      }
    }

    return products;
  }

  // Hook: called after page.goto() on the search page. Override in subclasses.
  async onPageLoad(page, query) {}

  // Strip Flipkart tracking params (ov_redirect, lid, ssid, etc.) to avoid redirect chains.
  // Keeps only the product path + pid param, which is sufficient to load the page directly.
  cleanProductUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const pid = url.searchParams.get('pid');
      return pid
        ? `${url.origin}${url.pathname}?pid=${pid}`
        : `${url.origin}${url.pathname}`;
    } catch (e) {
      return rawUrl;
    }
  }

  buildSearchUrl(query, pageNum = 1) {
    const base = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
    return pageNum > 1 ? `${base}&page=${pageNum}` : base;
  }

  filterAccessories(title) {
    return /\b(cases?|covers?|tempered|glass|protectors?|skins?|pouch|sleeves?|holders?|stands?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|straps?|films?|stickers?|rings?|mounts?|grips?|wallets?|folio|bumpers?|armbands?|stylus|pen|pencil|keyboard|mouse|dongles?|hubs?|docks?)\b/.test(title.toLowerCase());
  }

  async scrape(query, page) {
    const products = [];
    const maxPages = config.scraper.maxPages || 3;

    const searchUrl = this.buildSearchUrl(query);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Hook for subclasses to handle post-load setup (e.g. pincode prompt)
    await this.onPageLoad(page, query);

    try {
      await page.waitForSelector('[data-id]', { timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      const currentUrl = page.url();
      const pageTitle = await page.title().catch(() => '');
      const isCaptcha =
        currentUrl.includes('captcha') ||
        currentUrl.includes('/security/') ||
        pageTitle.toLowerCase().includes('captcha') ||
        pageTitle.toLowerCase().includes('security check') ||
        pageTitle.toLowerCase().includes('access denied');

      if (isCaptcha) {
        logger.warn('Flipkart: Bot detection / CAPTCHA page - will retry', { query, url: currentUrl, title: pageTitle });
        throw new Error(`Flipkart CAPTCHA detected (${pageTitle})`);
      }

      logger.warn('Flipkart: No products found', { query, url: currentUrl, title: pageTitle });
      return [];
    }

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenProducts = new Set();

    // --- Extract with scroll + pagination ---
    for (let pageNum = 1; pageNum <= maxPages && products.length < this.maxResults; pageNum++) {
      if (pageNum > 1) {
        // Flipkart uses &page=N
        const nextPageUrl = this.buildSearchUrl(query, pageNum);
        try {
          await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('[data-id]', { timeout: 8000 });
          await page.waitForTimeout(1500);
        } catch (e) {
          logger.info('Flipkart: No more pages', { pageNum });
          break;
        }
      }

      // Scroll to load lazy items/images
      await this.scrollToLoadMore(page, 5);

      const remaining = this.maxResults - products.length;
      const pageProducts = await this.extractPageItems(page, queryTokens, seenProducts, remaining);
      products.push(...pageProducts);

      logger.info('Flipkart: Page extracted', { pageNum, found: pageProducts.length, total: products.length });

      // Stop if this page had few results
      if (pageProducts.length < 5) break;
    }

    logger.info('Flipkart scrape complete', { query, found: products.length });

    // Extract offers from product pages if enabled.
    // Uses concurrent page visits (this.concurrentPageVisits tabs at a time) to stay within timeout.
    if (config.scraper.extractOffersFromProductPage && products.length > 0) {
      const maxToVisit = this.maxProductPagesToVisit ?? config.scraper.maxProductPagesToVisit;
      const visitCount = Math.min(products.length, maxToVisit);
      const concurrent = this.concurrentPageVisits ?? 1;
      logger.info('Extracting offers from Flipkart product pages', { count: visitCount, concurrent });

      for (let i = 0; i < visitCount; i += concurrent) {
        const batchIndices = [];
        for (let j = i; j < Math.min(i + concurrent, visitCount); j++) {
          batchIndices.push(j);
        }

        await Promise.allSettled(batchIndices.map(async (idx) => {
          if (!products[idx].productUrl) return;
          const newPage = await page.context().newPage();
          try {
            const detailedOffers = await this.extractOffersFromProductPage(newPage, products[idx].productUrl);
            if (detailedOffers.length > 0) {
              products[idx].rawOffers = [...new Set([...products[idx].rawOffers, ...detailedOffers])];
            }
          } finally {
            await newPage.close().catch(() => {});
          }
        }));

        // Brief pause between batches to avoid rate limiting
        if (i + concurrent < visitCount) {
          await page.waitForTimeout(400 + Math.random() * 400);
        }
      }
    }

    return products;
  }
}
