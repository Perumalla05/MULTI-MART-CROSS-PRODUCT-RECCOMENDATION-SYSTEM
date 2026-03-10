import playwright from 'playwright';

const PLATFORM = process.argv[2] || 'amazon'; // amazon, flipkart, croma
const QUERY = process.argv[3] || 'iphone 15';

const configs = {
  amazon: {
    url: 'https://www.amazon.in',
    searchSelector: '#twotabsearchtextbox',
    searchButtonSelector: '#nav-search-submit-button'
  },
  flipkart: {
    url: 'https://www.flipkart.com',
    searchSelector: 'input[name="q"]',
    searchButtonSelector: 'button[type="submit"]'
  },
  croma: {
    url: 'https://www.croma.com',
    searchSelector: 'input[placeholder*="Search"]',
    searchButtonSelector: 'button[type="submit"]'
  }
};

async function debug() {
  const config = configs[PLATFORM];
  if (!config) {
    console.error(`Unknown platform: ${PLATFORM}`);
    process.exit(1);
  }

  console.log(`\n🔍 Debugging ${PLATFORM.toUpperCase()} scraper`);
  console.log(`Query: "${QUERY}"\n`);

  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    // Navigate
    console.log(`⏳ Navigating to ${config.url}...`);
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('✅ Page loaded\n');

    // Search
    console.log(`⏳ Searching for "${QUERY}"...`);
    await page.fill(config.searchSelector, QUERY);
    await page.click(config.searchButtonSelector);
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ Search completed\n');

    // Wait a bit for dynamic content
    await page.waitForTimeout(3000);

    if (PLATFORM === 'amazon') {
      await debugAmazon(page);
    } else if (PLATFORM === 'flipkart') {
      await debugFlipkart(page);
    } else if (PLATFORM === 'croma') {
      await debugCroma(page);
    }

    console.log('\n✅ Debug complete. Browser will stay open for 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

async function debugAmazon(page) {
  console.log('📦 AMAZON DEBUG\n');

  // Check product containers
  const containers = await page.$$('[data-component-type="s-search-result"]');
  console.log(`Found ${containers.length} product containers\n`);

  if (containers.length === 0) {
    console.log('⚠️  No products found. Checking page structure...');
    const html = await page.content();
    console.log('Page title:', await page.title());
    return;
  }

  // Debug first 3 products
  for (let i = 0; i < Math.min(3, containers.length); i++) {
    console.log(`--- Product ${i + 1} ---`);
    const container = containers[i];

    // Title
    const titleEl = await container.$('.a-text-normal');
    const title = titleEl ? await titleEl.textContent() : 'NO TITLE';
    console.log(`Title: ${title.trim()}`);

    // Price
    const priceEl = await container.$('.a-price-whole');
    const price = priceEl ? await priceEl.textContent() : 'NO PRICE';
    console.log(`Price: ${price.trim()}`);

    // MRP
    const mrpEl = await container.$('.a-price.a-text-price .a-offscreen');
    const mrp = mrpEl ? await mrpEl.textContent() : 'NO MRP';
    console.log(`MRP: ${mrp.trim()}`);

    // Offers - check what elements exist
    const offerElements = await container.$$('.a-size-base');
    console.log(`Found ${offerElements.length} .a-size-base elements`);
    
    const offerTexts = [];
    for (const el of offerElements.slice(0, 10)) {
      const text = (await el.textContent()).trim();
      if (text.length > 0 && text.length < 200) {
        offerTexts.push(text);
      }
    }
    console.log('Offer texts:', offerTexts);

    // Image
    const imgEl = await container.$('img.s-image');
    const imgSrc = imgEl ? await imgEl.getAttribute('src') : 'NO IMAGE';
    console.log(`Image: ${imgSrc.substring(0, 60)}...`);

    // URL
    const linkEl = await container.$('a[href*="/dp/"]');
    const url = linkEl ? await linkEl.getAttribute('href') : 'NO URL';
    console.log(`URL: ${url.substring(0, 60)}...`);

    console.log('');
  }
}

async function debugFlipkart(page) {
  console.log('📦 FLIPKART DEBUG\n');

  const containers = await page.$$('[data-id]');
  console.log(`Found ${containers.length} [data-id] containers\n`);

  if (containers.length === 0) {
    console.log('⚠️  No products found. Checking page structure...');
    console.log('Page title:', await page.title());
    return;
  }

  for (let i = 0; i < Math.min(3, containers.length); i++) {
    console.log(`--- Product ${i + 1} ---`);
    const container = containers[i];

    const html = await container.innerHTML();
    
    // Title from img alt
    const imgEl = await container.$('img');
    const title = imgEl ? await imgEl.getAttribute('alt') : 'NO TITLE';
    console.log(`Title: ${title}`);

    // Price via regex
    const priceMatch = html.match(/₹([\d,]+)/);
    const price = priceMatch ? priceMatch[1] : 'NO PRICE';
    console.log(`Price: ₹${price}`);

    // Check for offers
    const offerElements = await container.$$('div, span');
    console.log(`Found ${offerElements.length} child elements`);

    console.log('');
  }
}

async function debugCroma(page) {
  console.log('📦 CROMA DEBUG\n');
  console.log('⚠️  Croma scraper not implemented yet');
}

debug();
