import playwright from 'playwright';

async function debugCromaCorrectURL() {
  console.log('\n🔍 Debugging Croma with correct URL\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const query = 'oneplus 15r';
  const searchUrl = `https://www.croma.com/searchB?q=${encodeURIComponent(query)}%3Arelevance&text=${encodeURIComponent(query)}`;
  
  console.log('URL:', searchUrl);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('Page title:', await page.title());

  // Test selectors
  const selectors = [
    '.product',
    '.product-item',
    'li.product',
    '[class*="product"]',
    'a[href*="/p/"]',
    '.plp-card',
    'article'
  ];

  console.log('\n=== TESTING SELECTORS ===\n');

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      console.log(`✅ ${selector}: Found ${elements.length} elements`);
    }
  }

  // Get first product details
  const productLinks = await page.$$('a[href*="/p/"]');
  if (productLinks.length > 0) {
    console.log(`\n=== FIRST PRODUCT ===\n`);
    const firstLink = productLinks[0];
    const href = await firstLink.getAttribute('href');
    const text = await firstLink.evaluate(node => node.innerText);
    console.log(`Link: ${href}`);
    console.log(`Text: ${text.substring(0, 200)}`);
  }

  // Get page text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== PAGE TEXT (first 1000 chars) ===\n');
  console.log(bodyText.substring(0, 1000));

  await page.waitForTimeout(30000);
  await browser.close();
}

debugCromaCorrectURL();
