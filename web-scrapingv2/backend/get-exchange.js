import playwright from 'playwright';

async function getExchangeText() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n🔍 Extracting exchange offers...\n');

  // Find accordion headers with exchange info
  const exchangeOffers = await page.evaluate(() => {
    const offers = [];
    
    // Look for accordion headers
    const accordions = document.querySelectorAll('.a-accordion-row, [class*="accordion"]');
    
    accordions.forEach(acc => {
      const text = acc.innerText;
      if (text && (text.includes('Exchange') || text.includes('trade-in'))) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // Look for "Up to ₹X off" pattern
        lines.forEach(line => {
          if (line.includes('Up to') && line.includes('off')) {
            offers.push(line);
          }
        });
      }
    });
    
    return offers;
  });

  console.log('Exchange offers found:');
  exchangeOffers.forEach((offer, i) => {
    console.log(`${i + 1}. ${offer}`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

getExchangeText();
