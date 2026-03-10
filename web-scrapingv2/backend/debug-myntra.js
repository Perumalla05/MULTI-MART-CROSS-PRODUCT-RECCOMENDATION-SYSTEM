import playwright from 'playwright';

async function debugMyntra() {
  console.log('\n🔍 Debugging Myntra\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const query = 'nike shoes';
  const searchUrl = `https://www.myntra.com/${encodeURIComponent(query)}`;
  
  console.log('URL:', searchUrl);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);

  console.log('Page title:', await page.title());

  // Test selectors
  const selectors = [
    '.product-base',
    '.product-productMetaInfo',
    'li.product-base',
    '[class*="product"]',
    'article'
  ];

  console.log('\n=== TESTING SELECTORS ===\n');

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      console.log(`✅ ${selector}: Found ${elements.length} elements`);
    }
  }

  // Get first product
  const products = await page.$$('li.product-base, .product-base');
  if (products.length > 0) {
    console.log('\n=== FIRST PRODUCT ===\n');
    const first = products[0];
    const text = await first.evaluate(node => node.innerText);
    console.log('Text:', text);
  }

  // Get page text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== PAGE TEXT (first 1000 chars) ===\n');
  console.log(bodyText.substring(0, 1000));

  await page.waitForTimeout(30000);
  await browser.close();
}

debugMyntra();
