import playwright from 'playwright';

async function debugRelianceDigital() {
  console.log('\n🔍 Debugging Reliance Digital\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const query = 'oneplus 15r';
  const searchUrl = `https://www.reliancedigital.in/products?q=${encodeURIComponent(query)}&page_no=1&page_size=12&page_type=number`;
  
  console.log('URL:', searchUrl);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);

  console.log('Page title:', await page.title());

  // Test selectors
  const selectors = [
    '.sp',
    '.product',
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

  // Get first product if found
  const products = await page.$$('.sp__product, [class*="product"]');
  console.log(`\nFound ${products.length} products\n`);
  
  if (products.length > 0) {
    console.log('=== FIRST 2 PRODUCTS ===\n');
    
    for (let i = 0; i < Math.min(2, products.length); i++) {
      const product = products[i];
      const text = await product.evaluate(node => node.innerText);
      const html = await product.innerHTML();
      
      console.log(`--- Product ${i + 1} ---`);
      console.log('Text:', text);
      console.log('HTML (first 500 chars):', html.substring(0, 500));
      console.log('');
    }
  }

  // Get page text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n=== PAGE TEXT (first 1000 chars) ===\n');
  console.log(bodyText.substring(0, 1000));

  await page.waitForTimeout(30000);
  await browser.close();
}

debugRelianceDigital();
