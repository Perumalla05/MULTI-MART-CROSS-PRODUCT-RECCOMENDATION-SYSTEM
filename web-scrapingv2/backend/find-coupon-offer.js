import playwright from 'playwright';

async function findCouponOffer() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('\n🔍 Lines BEFORE "Bank offers":\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase() === 'bank offers') {
      // Show 20 lines before
      for (let j = Math.max(0, i - 20); j < i; j++) {
        console.log(`${j}: ${lines[j]}`);
      }
      break;
    }
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

findCouponOffer();
