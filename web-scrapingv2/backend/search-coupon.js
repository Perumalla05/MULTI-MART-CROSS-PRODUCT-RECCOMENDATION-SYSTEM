import playwright from 'playwright';

async function searchCoupon() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('\n🔍 Lines containing "coupon" or "code":\n');

  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    if (lower.includes('coupon') || (lower.includes('code') && line.length < 100)) {
      console.log(`${i}: ${line}`);
    }
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

searchCoupon();
