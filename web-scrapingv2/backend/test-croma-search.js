import playwright from 'playwright';

async function testCromaSearch() {
  console.log('\n🔍 Testing different Croma search formats\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const searchTerms = [
    'https://www.croma.com/search?q=oneplus+15r',
    'https://www.croma.com/search?q=oneplus%2015r',
    'https://www.croma.com/search?q=oneplus',
    'https://www.croma.com/searchB2C?q=oneplus+15r',
    'https://www.croma.com/phones-wearables/mobile-phones/c/10?q=oneplus'
  ];

  for (const url of searchTerms) {
    console.log(`\n=== Testing: ${url} ===`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const text = await page.evaluate(() => document.body.innerText);
    const hasProducts = text.includes('₹') || text.toLowerCase().includes('oneplus');
    
    console.log(`Has products: ${hasProducts ? '✅' : '❌'}`);
    
    if (hasProducts) {
      console.log('First 500 chars of text:');
      console.log(text.substring(0, 500));
      break;
    }
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

testCromaSearch();
