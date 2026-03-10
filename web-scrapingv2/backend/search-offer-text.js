import playwright from 'playwright';

async function searchOfferText() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const fullText = await page.evaluate(() => document.body.innerText);
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('\n🔍 All lines containing "offer" (case insensitive):\n');

  lines.forEach((line, i) => {
    if (line.toLowerCase().includes('offer') && line.length > 5) {
      console.log(`${i}: ${line}`);
    }
  });

  console.log('\n\n🔍 All lines containing "bank":\n');

  lines.forEach((line, i) => {
    if (line.toLowerCase().includes('bank') && line.length > 5) {
      console.log(`${i}: ${line}`);
    }
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

searchOfferText();
