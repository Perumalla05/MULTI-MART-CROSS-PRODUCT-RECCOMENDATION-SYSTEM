import playwright from 'playwright';

async function testCromaScraper() {
  console.log('\n🔍 Testing Croma scraper logic\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const query = 'oneplus 15r';
  const searchUrl = `https://www.croma.com/searchB?q=${encodeURIComponent(query)}%3Arelevance&text=${encodeURIComponent(query)}`;
  
  console.log('URL:', searchUrl);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // Wait longer for dynamic content

  const items = await page.$$('li.product-item');
  console.log(`\nFound ${items.length} product items\n`);

  if (items.length > 0) {
    console.log('=== FIRST 3 PRODUCTS ===\n');
    
    for (let i = 0; i < Math.min(3, items.length); i++) {
      const item = items[i];
      const text = await item.evaluate(node => node.innerText);
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      console.log(`--- Product ${i + 1} ---`);
      console.log('Lines:', lines);
      
      // Title
      const title = lines.find(l => l.length > 20 && !l.includes('₹'));
      console.log('Title:', title);
      
      // Prices
      const priceLines = lines.filter(l => l.includes('₹'));
      console.log('Price lines:', priceLines);
      
      // Link
      const linkEl = await item.$('a[href*="/p/"]');
      const href = linkEl ? await linkEl.getAttribute('href') : null;
      console.log('Link:', href);
      
      console.log('');
    }
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

testCromaScraper();
