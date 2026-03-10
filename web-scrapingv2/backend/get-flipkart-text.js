import playwright from 'playwright';

async function getFlipkartText() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  
  const lines = bodyText.split('\n');
  
  console.log('\n🔍 Lines containing offer keywords:\n');
  
  lines.forEach((line, i) => {
    const lower = line.toLowerCase().trim();
    if ((lower.includes('bank') || lower.includes('emi') || 
         lower.includes('exchange') || lower.includes('cashback') ||
         lower.includes('discount')) && 
        line.length > 15 && line.length < 200) {
      console.log(`${i}. ${line.trim()}`);
    }
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

getFlipkartText();
