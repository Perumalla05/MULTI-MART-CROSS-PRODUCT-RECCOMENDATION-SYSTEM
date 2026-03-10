import BaseScraper from '../base.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

export default class AmazonScraper extends BaseScraper {
  constructor() {
    super('Amazon');
    this.baseUrl = 'https://www.amazon.in';
  }

  async extractOffersFromProductPage(page, productUrl) {
    try {
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2000);

      const offers = [];
      const seenOffers = new Set();

      // Extract EMI info
      const emiText = await page.evaluate(() => {
        const emiEl = document.querySelector('[id*="emi"]');
        return emiEl ? emiEl.innerText : '';
      });
      
      if (emiText && emiText.toLowerCase().includes('no cost emi available')) {
        offers.push('No Cost EMI available');
      }

      // Extract offers from offers-items containers
      const offerItems = await page.$$('.offers-items');
      
      for (const item of offerItems) {
        const text = await item.evaluate(node => node.innerText);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        for (const line of lines) {
          if (line.length > 20 && line.length < 250) {
            const lower = line.toLowerCase();
            
            // Match offer descriptions (broad — noise filter below handles false positives)
            const isOffer =
              lower.includes('upto') || lower.includes('up to') ||
              lower.includes('discount') || lower.includes('cashback') ||
              lower.includes('emi interest savings') ||
              lower.includes('instant discount') ||
              (lower.includes('flat') && lower.includes('off')) ||
              (lower.includes('extra') && lower.includes('off')) ||
              (lower.includes('save') && (lower.includes('₹') || lower.includes('%')));
            
            // Exclude headers, noise, and truncated versions (ending with …)
            const isNoise = 
              lower === 'offers' || lower === 'no cost emi' || 
              lower === 'bank offer' || lower === 'cashback' ||
              /^\d+\s+offers?$/i.test(line) || line.endsWith('…');
            
            if (isOffer && !isNoise && !seenOffers.has(line)) {
              seenOffers.add(line);
              offers.push(line);
            }
          }
        }
      }

      // Extract exchange offers from accordion sections
      const exchangeOffers = await page.evaluate(() => {
        const offers = [];
        const accordions = document.querySelectorAll('.a-accordion-row, [class*="accordion"]');
        
        accordions.forEach(acc => {
          const text = acc.innerText;
          if (text && text.toLowerCase().includes('exchange')) {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            for (const line of lines) {
              if ((line.includes('Up to') || line.includes('Upto')) && 
                  (line.includes('off') || line.includes('₹')) &&
                  line.length > 15 && line.length < 150) {
                offers.push(line);
              }
            }
          }
        });
        
        return offers;
      });

      // Add exchange offers
      exchangeOffers.forEach(offer => {
        if (!seenOffers.has(offer)) {
          seenOffers.add(offer);
          offers.push(offer);
        }
      });

      // Fallback: if .offers-items returned nothing (e.g. fashion product pages use different HTML),
      // scan known offer containers for bank/discount offers
      if (offers.length === 0) {
        const fallbackOffers = await page.evaluate(() => {
          const results = [];
          const seen = new Set();
          // Amazon uses various container IDs/classes for offers on different page types
          const containers = document.querySelectorAll(
            '#sopp_feature_div, #dealsBlockContent, #buybox-see-all-buying-choices,' +
            ' [id*="offer"], [class*="offer"], .a-section.a-spacing-small'
          );
          containers.forEach(el => {
            const lines = (el.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 20 && l.length < 200);
            for (const line of lines) {
              const lower = line.toLowerCase();
              const hasKeyword =
                lower.includes('discount') || lower.includes('cashback') ||
                lower.includes('instant discount') || lower.includes('bank') ||
                lower.includes('credit card') || lower.includes('debit card') ||
                lower.includes('upi') || lower.includes('coupon') ||
                (lower.includes('flat') && lower.includes('off')) ||
                (lower.includes('extra') && lower.includes('off')) ||
                (lower.includes('save') && (lower.includes('₹') || lower.includes('%')));
              const isNoise =
                /^₹[\d,]+(\.\d+)?$/.test(line.trim()) ||
                /^\d+%?\s*off$/i.test(line.trim()) ||
                lower === 'offers' || lower === 'bank offer' || lower === 'cashback';
              if (hasKeyword && !isNoise && !seen.has(line)) {
                seen.add(line);
                results.push(line);
              }
            }
          });
          return results.slice(0, 8);
        });
        fallbackOffers.forEach(o => {
          if (!seenOffers.has(o)) { seenOffers.add(o); offers.push(o); }
        });
      }

      return offers.slice(0, 10);
    } catch (error) {
      logger.warn('Failed to extract offers from product page', { url: productUrl, error: error.message });
      return [];
    }
  }

  // Extract regular (non-sponsored) products from current page
  async extractRegularItems(page, queryTokens, seenAsins, seenUrls, maxCount) {
    const products = [];
    const allItems = await page.$$('[data-component-type="s-search-result"], .s-result-item[data-asin]:not([data-asin=""]), [data-asin]:not([data-asin=""])');

    for (let i = 0; i < allItems.length && products.length < maxCount; i++) {
      try {
        const item = allItems[i];

        const asin = await item.getAttribute('data-asin');
        if (!asin || asin === '') continue;
        if (seenAsins.has(asin)) continue;
        seenAsins.add(asin);

        // Title - extract brand + product title
        let title = null;
        let brand = '';

        const h2Elements = await item.$$('h2');
        if (h2Elements.length >= 2) {
          brand = (await h2Elements[0].textContent()).trim();
          const titleSpan = await h2Elements[1].$('a span');
          title = titleSpan ? (await titleSpan.textContent()).trim() : (await h2Elements[1].textContent()).trim();
        } else if (h2Elements.length === 1) {
          const titleSpan = await h2Elements[0].$('a span');
          title = titleSpan ? (await titleSpan.textContent()).trim() : (await h2Elements[0].textContent()).trim();
        }

        if (!title || title.length < 10) {
          for (const selector of ['.a-size-medium.a-text-normal', '.s-title-instructions-style']) {
            const titleEl = await item.$(selector);
            if (titleEl) {
              const text = (await titleEl.textContent()).trim();
              if (text && text.length > 10) { title = text; break; }
            }
          }
        }

        if (!title || title.length < 10) continue;

        if (brand && !title.toLowerCase().startsWith(brand.toLowerCase())) {
          title = `${brand} ${title}`;
        }

        title = title
          .replace(/Sponsored\s*/gi, '')
          .replace(/You are seeing this ad based on the product['']?s relevance to your search query\.?\s*/gi, '')
          .replace(/Let us know\s*/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Skip accessories (overridable in subclasses)
        if (this.filterAccessories(title)) continue;

        // Check if sponsored item in regular results loop
        const isSponsored = await item.evaluate(el => el.classList.contains('AdHolder'));

        if (!isSponsored) {
          const titleNorm = this.normalizeForMatch(title);
          if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;
        }

        // Price
        let basePrice = null;
        for (const selector of ['.a-price-whole', '.a-price .a-offscreen', '.a-price-symbol + .a-price-whole']) {
          const priceEl = await item.$(selector);
          if (priceEl) { basePrice = (await priceEl.textContent()).trim(); if (basePrice) break; }
        }
        if (!basePrice) continue;

        const mrpEl = await item.$('.a-price.a-text-price .a-offscreen');
        const mrp = mrpEl ? (await mrpEl.textContent()).trim() : null;

        // Offers from search listing
        const offers = [];
        const seenOffers = new Set();
        const offerElements = await item.$$('.a-size-base, .a-color-secondary, .a-color-success');
        for (const offerEl of offerElements) {
          try {
            const text = (await offerEl.textContent()).trim();
            if (text && text.length > 10 && text.length < 100) {
              const lowerText = text.toLowerCase();
              const hasOfferKeyword =
                lowerText.includes('save extra') || lowerText.includes('bank offer') ||
                lowerText.includes('coupon') || lowerText.includes('no cost emi') ||
                lowerText.includes('exchange') || lowerText.includes('cashback') ||
                lowerText.includes('instant discount') ||
                (lowerText.includes('extra') && lowerText.includes('off')) ||
                (lowerText.includes('flat') && lowerText.includes('off')) ||
                (lowerText.includes('save') && lowerText.includes('₹'));
              const isNoise =
                lowerText.includes('m.r.p') || lowerText.includes('price') ||
                /^₹[\d,]+(\.\d+)?$/.test(text.trim()) ||
                /^\d+%?\s*off$/i.test(text.trim()) ||
                /^\d+$/.test(text);
              if (hasOfferKeyword && !isNoise && !seenOffers.has(text)) {
                seenOffers.add(text); offers.push(text);
              }
            }
          } catch (e) { /* skip */ }
        }

        // Link
        const linkEl = await item.$('h2 a, .a-link-normal, a[href*="/dp/"]');
        const href = linkEl ? await linkEl.getAttribute('href') : null;
        if (!href) continue;
        const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const asinFromUrl = fullUrl.match(/\/dp\/([A-Z0-9]{10})/);
        const urlAsin = asinFromUrl ? asinFromUrl[1] : null;
        if (urlAsin && seenUrls.has(urlAsin)) continue;
        if (urlAsin) seenUrls.add(urlAsin);

        // Image
        const imgEl = await item.$('img.s-image, img');
        const imageUrl = imgEl ? await imgEl.getAttribute('src') : null;

        // Rating — use aria-label attributes which are stable across Amazon redesigns
        const ratingData = await item.evaluate(el => {
          // Rating value: <span aria-label="4.3 out of 5 stars"> or hidden .a-icon-alt span
          let rating = null;
          const starEl = el.querySelector('[aria-label*="out of 5 stars"]');
          if (starEl) {
            const m = starEl.getAttribute('aria-label').match(/([\d.]+)\s*out\s*of/i);
            if (m) rating = parseFloat(m[1]);
          }
          if (!rating) {
            const altEl = el.querySelector('.a-icon-alt');
            if (altEl) {
              const m = altEl.textContent.match(/([\d.]+)\s*out\s*of/i);
              if (m) rating = parseFloat(m[1]);
            }
          }

          // Review count: <a aria-label="1,234 ratings"> or .s-underline-text span
          let ratingCount = null;
          const countLinkEl = el.querySelector('a[aria-label$=" ratings"], a[aria-label$=" rating"]');
          if (countLinkEl) {
            const num = countLinkEl.getAttribute('aria-label').replace(/[^0-9]/g, '');
            if (num) ratingCount = parseInt(num);
          }
          if (!ratingCount) {
            const countSpan = el.querySelector('.s-underline-text, .a-size-base.s-underline-text');
            if (countSpan) {
              const num = countSpan.textContent.trim().replace(/,/g, '');
              if (/^\d+$/.test(num)) ratingCount = parseInt(num);
            }
          }

          return { rating, ratingCount };
        });

        const product = this.createProduct({
          title,
          basePrice: this.normalizePrice(basePrice),
          mrp: mrp ? this.normalizePrice(mrp) : null,
          productUrl: fullUrl,
          imageUrl: imageUrl || '',
          rawOffers: offers,
          rating: ratingData.rating,
          ratingCount: ratingData.ratingCount
        });

        if (product.mrp && product.basePrice && product.mrp > product.basePrice) {
          product.discountPercent = Math.round(
            ((product.mrp - product.basePrice) / product.mrp) * 100
          );
        }

        products.push(product);

      } catch (error) {
        logger.warn('Failed to parse Amazon product', { index: i, error: error.message });
      }
    }

    return products;
  }

  buildSearchUrl(query, pageNum = 1) {
    const base = `${this.baseUrl}/s?k=${encodeURIComponent(query)}`;
    return pageNum > 1 ? `${base}&page=${pageNum}` : base;
  }

  filterAccessories(title) {
    return /\b(cases?|covers?|tempered|glass|protectors?|skins?|pouch|sleeves?|holders?|stands?|chargers?|cables?|adapters?|earphones?|earbuds?|neckbands?|headphones?|headsets?|tws|straps?|films?|stickers?|rings?|mounts?|grips?|wallets?|folio|bumpers?|armbands?|stylus|pen|pencil|keyboard|mouse|dongles?|hubs?|docks?)\b/.test(title.toLowerCase());
  }

  async scrape(query, page) {
    const products = [];
    const sponsoredCollected = [];
    const maxPages = config.scraper.maxPages || 3;

    const searchUrl = this.buildSearchUrl(query);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    try {
      await page.waitForSelector('[data-component-type="s-search-result"], .s-result-item', { timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      const currentUrl = page.url();
      const pageTitle = await page.title().catch(() => '');
      const pageTitleLower = pageTitle.toLowerCase();
      const isCaptcha =
        currentUrl.includes('validateCaptcha') ||
        currentUrl.includes('/errors/') ||
        pageTitleLower.includes('robot') ||
        pageTitleLower.includes('captcha') ||
        pageTitleLower.includes('sorry') ||
        pageTitleLower.includes('503') ||
        pageTitleLower.includes('service unavailable') ||
        pageTitleLower.includes('access denied') ||
        pageTitleLower.includes('page not found') && currentUrl.includes('amazon');

      if (isCaptcha) {
        logger.warn('Amazon: Bot detection / CAPTCHA page - will retry', { query, url: currentUrl, title: pageTitle });
        throw new Error(`Amazon CAPTCHA detected (${pageTitle})`);
      }

      logger.warn('Amazon: No products found', { query, url: currentUrl, title: pageTitle });
      return [];
    }

    const queryNorm = this.normalizeForMatch(query);
    const queryTokens = queryNorm.split(/\s+/).filter(t => t.length > 2);
    const seenAsins = new Set();
    const seenUrls = new Set();

    // --- Extract sponsored products (page 1 only) ---
    try {
      const sponsoredProducts = await page.evaluate(() => {
        const results = [];
        const seenKeys = new Set();

        // Type 1: Top banner AdHolder
        document.querySelectorAll('.AdHolder.s-flex-full-width').forEach(banner => {
          const imgs = banner.querySelectorAll('img[alt]');
          imgs.forEach(img => {
            const alt = img.alt?.trim() || '';
            if (alt.length < 30) return;
            const title = alt;
            const link = img.closest('a');
            const href = link?.getAttribute('href') || '';
            const imageUrl = img.src || '';
            let price = '';
            let mrp = '';
            let container = img.parentElement;
            for (let depth = 0; depth < 8 && container; depth++) {
              const priceEl = container.querySelector('.a-price .a-offscreen');
              if (priceEl) {
                price = priceEl.textContent.trim();
                const mrpEl = container.querySelector('.a-price.a-text-price .a-offscreen');
                if (mrpEl) mrp = mrpEl.textContent.trim();
                break;
              }
              container = container.parentElement;
            }
            const key = title.substring(0, 60);
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              results.push({ asin: '', title, href, imageUrl, price, mrp, source: 'banner' });
            }
          });
        });

        // Type 2: Inline sponsored
        document.querySelectorAll('.s-featured-result-item').forEach(item => {
          let asin = '';
          const csaEl = item.querySelector('[data-csa-c-item-id]');
          if (csaEl) {
            const csaId = csaEl.getAttribute('data-csa-c-item-id');
            const asinMatch = csaId.match(/amzn1\.asin\.([A-Z0-9]{10})/);
            if (asinMatch) asin = asinMatch[1];
          }
          if (!asin || seenKeys.has(asin)) return;
          seenKeys.add(asin);

          const h2s = item.querySelectorAll('h2');
          let brand = '';
          let title = '';
          if (h2s.length >= 2) {
            brand = h2s[0].textContent?.trim() || '';
            const titleSpan = h2s[1].querySelector('a span') || h2s[1].querySelector('span');
            title = titleSpan?.textContent?.trim() || '';
          } else if (h2s.length === 1) {
            const titleSpan = h2s[0].querySelector('a span') || h2s[0].querySelector('span');
            title = titleSpan?.textContent?.trim() || '';
          }
          if (brand && title && !title.toLowerCase().startsWith(brand.toLowerCase())) {
            title = brand + ' ' + title;
          }

          const h2 = h2s.length >= 2 ? h2s[1] : h2s[0];
          const link = h2?.querySelector('a') || item.querySelector('a[href*="/dp/"]');
          const href = link?.getAttribute('href') || `/dp/${asin}`;
          const img = item.querySelector('img.s-image, img');
          const imageUrl = img?.src || '';
          const priceOffscreen = item.querySelector('.a-price .a-offscreen');
          const priceWhole = item.querySelector('.a-price-whole');
          let price = '';
          if (priceOffscreen) price = priceOffscreen.textContent.trim();
          else if (priceWhole) price = priceWhole.textContent.trim();
          const mrpEl = item.querySelector('.a-price.a-text-price .a-offscreen');
          const mrp = mrpEl ? mrpEl.textContent.trim() : '';

          if (title.length > 10) {
            results.push({ asin, title, href, imageUrl, price, mrp, source: 'inline' });
          }
        });

        return results;
      });

      for (const sp of sponsoredProducts) {
        const dedupKey = sp.asin || sp.title.substring(0, 60);
        if (seenAsins.has(dedupKey)) continue;
        seenAsins.add(dedupKey);
        if (sp.asin) seenUrls.add(sp.asin);

        let title = sp.title
          .replace(/Sponsored\s*/gi, '')
          .replace(/You are seeing this ad based on the product['']?s relevance to your search query\.?\s*/gi, '')
          .replace(/Let us know\s*/gi, '')
          .replace(/Sponsored Ad - /gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!title || title.length < 10) continue;

        // Skip accessories (overridable in subclasses)
        if (this.filterAccessories(title)) continue;

        const titleNorm = this.normalizeForMatch(title);
        if (!this.titleMatchesTokens(titleNorm, queryTokens)) continue;

        const fullUrl = sp.href.startsWith('http') ? sp.href : `${this.baseUrl}${sp.href}`;
        const basePrice = sp.price ? this.normalizePrice(sp.price) : null;
        const mrp = sp.mrp ? this.normalizePrice(sp.mrp) : null;
        if (!basePrice) continue;

        const product = this.createProduct({
          title, basePrice, mrp,
          productUrl: fullUrl,
          imageUrl: sp.imageUrl || '',
          rawOffers: []
        });

        if (product.mrp && product.basePrice && product.mrp > product.basePrice) {
          product.discountPercent = Math.round(
            ((product.mrp - product.basePrice) / product.mrp) * 100
          );
        }

        sponsoredCollected.push(product);
      }

      if (sponsoredProducts.length > 0) {
        logger.info('Amazon: Extracted sponsored products', { count: sponsoredProducts.length, added: sponsoredCollected.length });
      }
    } catch (e) {
      logger.warn('Amazon: Failed to extract sponsored products', { error: e.message });
    }

    // --- Extract regular results with scroll + pagination ---
    for (let pageNum = 1; pageNum <= maxPages && products.length < this.maxResults; pageNum++) {
      if (pageNum > 1) {
        // Navigate to next page
        const nextPageUrl = this.buildSearchUrl(query, pageNum);
        try {
          await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('[data-component-type="s-search-result"], .s-result-item', { timeout: 8000 });
          await page.waitForTimeout(1500);
        } catch (e) {
          logger.info('Amazon: No more pages', { pageNum });
          break;
        }
      }

      // Scroll to load lazy images and items
      await this.scrollToLoadMore(page, 5);

      const remaining = this.maxResults - products.length;
      const pageProducts = await this.extractRegularItems(page, queryTokens, seenAsins, seenUrls, remaining);
      products.push(...pageProducts);

      logger.info('Amazon: Page extracted', { pageNum, found: pageProducts.length, total: products.length });

      // Stop if this page had few results (likely last page)
      if (pageProducts.length < 5) break;
    }

    // Append sponsored after regular results
    for (const sp of sponsoredCollected) {
      if (products.length < this.maxResults) {
        products.push(sp);
      }
    }

    logger.info('Amazon scrape complete', { query, found: products.length, sponsored: sponsoredCollected.length });

    // Extract offers from product pages if enabled
    if (config.scraper.extractOffersFromProductPage && products.length > 0) {
      const regularCount = products.length - sponsoredCollected.length;
      const pagesToVisitLimit = this.maxProductPagesToVisit != null
        ? this.maxProductPagesToVisit
        : config.scraper.maxProductPagesToVisit;
      const maxRegular = Math.min(regularCount, pagesToVisitLimit);
      const toVisit = new Set();

      for (let i = 0; i < maxRegular; i++) {
        toVisit.add(i);
      }
      for (let i = regularCount; i < products.length; i++) {
        if (products[i].productUrl && products[i].productUrl.includes('amazon.in/')) {
          toVisit.add(i);
        }
      }

      logger.info('Extracting offers from product pages', { count: toVisit.size });

      for (const i of toVisit) {
        if (products[i].productUrl) {
          const detailedOffers = await this.extractOffersFromProductPage(page, products[i].productUrl);
          if (detailedOffers.length > 0) {
            products[i].rawOffers = [...new Set([...products[i].rawOffers, ...detailedOffers])];
          }
        }
      }
    }

    return products;
  }
}
