import playwright from 'playwright';

async function findCouponIn12GB() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Search and click on 12GB variant
  await page.goto('https://www.flipkart.com/search?q=oneplus+15r', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click first product
  const firstProduct = await page.$('[data-id] a');
  if (firstProduct) {
    await firstProduct.click();
    await page.waitForTimeout(3000);
  }

  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('\n🔍 Searching for coupon/offer text:\n');

  // Find Bank offers and show lines before it
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase() === 'bank offers') {
      console.log('=== 30 lines BEFORE Bank offers ===\n');
      for (let j = Math.max(0, i - 30); j < i; j++) {
        console.log(`${j}: ${lines[j]}`);
      }
      break;
    }
  }

  console.log('\n\n🔍 Lines with "coupon", "code", or "off":\n');
  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    if ((lower.includes('coupon') || lower.includes('code') || 
         (lower.includes('off') && line.includes('₹'))) && 
        line.length > 10 && line.length < 150 && i < 100) {
      console.log(`${i}: ${line}`);
    }
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findCouponIn12GB();
