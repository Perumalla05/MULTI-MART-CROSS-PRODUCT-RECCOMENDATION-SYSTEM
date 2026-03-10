import playwright from 'playwright';

async function debugCroma() {
  console.log('\n🔍 Debugging Croma search page\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.croma.com/search?q=oneplus+15r', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('Page title:', await page.title());
  console.log('URL:', page.url());

  // Try different selectors
  const selectors = [
    '.product',
    '.product-item',
    '[data-product]',
    '.plp-card',
    'li.product',
    'article',
    '[class*="product"]',
    '[class*="card"]'
  ];

  console.log('\n=== TESTING SELECTORS ===\n');

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      console.log(`✅ ${selector}: Found ${elements.length} elements`);
    } else {
      console.log(`❌ ${selector}: Not found`);
    }
  }

  // Get page HTML structure
  console.log('\n=== PAGE STRUCTURE (first 2000 chars) ===\n');
  const html = await page.content();
  console.log(html.substring(0, 2000));

  // Get visible text
  console.log('\n\n=== VISIBLE TEXT (first 1000 chars) ===\n');
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 1000));

  await page.waitForTimeout(60000);
  await browser.close();
}

debugCroma();
