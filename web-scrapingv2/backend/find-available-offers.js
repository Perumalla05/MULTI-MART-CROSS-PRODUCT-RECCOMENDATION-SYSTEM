import playwright from 'playwright';

async function findAvailableOffers() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  
  const lines = bodyText.split('\n');
  
  console.log('\n🔍 Looking for "Available offers" section:\n');
  
  let foundSection = false;
  let count = 0;
  
  lines.forEach((line, i) => {
    if (line.includes('Available offers') || line.includes('available offers')) {
      foundSection = true;
      console.log(`\n=== Found at line ${i} ===\n`);
    }
    
    if (foundSection && count < 20) {
      console.log(`${i}. ${line}`);
      count++;
    }
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findAvailableOffers();
