import playwright from 'playwright';

async function debugCromaDynamic() {
  console.log('\n🔍 Debugging Croma with longer wait\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.croma.com/search?q=oneplus+15r', { waitUntil: 'networkidle' });
  
  console.log('Waiting 10 seconds for dynamic content...');
  await page.waitForTimeout(10000);

  const text = await page.evaluate(() => document.body.innerText);
  
  console.log('\n=== PAGE TEXT ===\n');
  console.log(text);

  // Check if "No results" or similar
  if (text.toLowerCase().includes('no result') || text.toLowerCase().includes('not found')) {
    console.log('\n⚠️  No results found for this search');
  }

  // Try to find any product-like elements
  const allDivs = await page.$$('div');
  console.log(`\nTotal divs on page: ${allDivs.length}`);

  await page.waitForTimeout(30000);
  await browser.close();
}

debugCromaDynamic();
