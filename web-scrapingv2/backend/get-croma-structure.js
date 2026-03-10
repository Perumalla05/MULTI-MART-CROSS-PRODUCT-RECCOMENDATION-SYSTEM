import playwright from 'playwright';

async function getCromaStructure() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const searchUrl = 'https://www.croma.com/searchB?q=oneplus%2015r%3Arelevance&text=oneplus%2015r';
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n🔍 Croma Product Structure\n');

  const products = await page.$$('.product-item');
  console.log(`Found ${products.length} products\n`);

  if (products.length > 0) {
    console.log('=== FIRST PRODUCT ===\n');
    const first = products[0];
    
    const html = await first.innerHTML();
    console.log('HTML (first 1500 chars):');
    console.log(html.substring(0, 1500));
    
    const text = await first.evaluate(node => node.innerText);
    console.log('\n\nINNER TEXT:');
    console.log(text);
    
    // Try to extract details
    const title = await first.$eval('a[href*="/p/"]', el => el.textContent).catch(() => null);
    const link = await first.$eval('a[href*="/p/"]', el => el.href).catch(() => null);
    const img = await first.$eval('img', el => el.src).catch(() => null);
    
    console.log('\n\nEXTRACTED:');
    console.log('Title:', title);
    console.log('Link:', link);
    console.log('Image:', img);
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

getCromaStructure();
