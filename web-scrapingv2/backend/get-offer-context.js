import playwright from 'playwright';

async function getOfferContext() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const fullText = await page.evaluate(() => document.body.innerText);
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('\n🔍 Context around "Bank offers":\n');

  // Find line 42 and show context
  console.log('=== Around line 42 ===\n');
  for (let i = 35; i < 85; i++) {
    const marker = (i === 42 || i === 76) ? '>>> ' : '    ';
    console.log(`${marker}${i}: ${lines[i]}`);
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

getOfferContext();
