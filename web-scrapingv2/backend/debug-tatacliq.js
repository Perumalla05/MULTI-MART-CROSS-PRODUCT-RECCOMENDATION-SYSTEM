import playwright from 'playwright';

async function debugTataCliq() {
  console.log('\n🔍 Debugging Tata CLiQ search page\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const query = 'iphone 15';
  const searchUrl = `https://www.tatacliq.com/search/?searchText=${encodeURIComponent(query)}`;
  
  console.log('URL:', searchUrl);

  await page.goto(searchUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);

  console.log('Page title:', await page.title());

  // Test selectors
  const selectors = [
    '.ProductModule__base',
    '.SearchModule__product',
    '[class*="product"]',
    '[class*="Product"]',
    'article',
    '.card'
  ];

  console.log('\n=== TESTING SELECTORS ===\n');

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      console.log(`✅ ${selector}: Found ${elements.length} elements`);
    }
  }

  // Get page text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== PAGE TEXT (first 1000 chars) ===\n');
  console.log(bodyText.substring(0, 1000));

  // Check for products
  const hasProducts = bodyText.includes('₹') || bodyText.toLowerCase().includes('oneplus');
  console.log(`\n\nHas products: ${hasProducts ? '✅' : '❌'}`);

  await page.waitForTimeout(30000);
  await browser.close();
}

debugTataCliq();
