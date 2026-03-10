import playwright from 'playwright';

async function findAllOffers() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n🔍 Finding ALL offer types...\n');

  // Search for exchange-related text
  const result = await page.evaluate(() => {
    const results = {
      offersItems: [],
      exchangeOffers: [],
      allOfferText: []
    };
    
    // Get all .offers-items
    const offerItems = document.querySelectorAll('.offers-items');
    offerItems.forEach(item => {
      results.offersItems.push(item.innerText);
    });
    
    // Search for exchange text
    const allText = document.body.innerText;
    const lines = allText.split('\n');
    lines.forEach(line => {
      const lower = line.toLowerCase().trim();
      if ((lower.includes('exchange') || lower.includes('trade-in')) && 
          line.length > 15 && line.length < 200) {
        results.exchangeOffers.push(line.trim());
      }
    });
    
    // Look for any element with "offer" in ID or class
    const offerElements = document.querySelectorAll('[id*="offer"], [class*="offer"]');
    offerElements.forEach(el => {
      const text = el.innerText;
      if (text && text.length > 20 && text.length < 300) {
        const lower = text.toLowerCase();
        if (lower.includes('exchange') || lower.includes('save') || 
            lower.includes('discount') || lower.includes('cashback')) {
          results.allOfferText.push(text.substring(0, 200));
        }
      }
    });
    
    return results;
  });

  console.log('=== OFFERS-ITEMS ===');
  result.offersItems.forEach((text, i) => {
    console.log(`\n${i + 1}. ${text.substring(0, 150)}`);
  });

  console.log('\n\n=== EXCHANGE OFFERS ===');
  const uniqueExchange = [...new Set(result.exchangeOffers)];
  uniqueExchange.slice(0, 10).forEach((text, i) => {
    console.log(`${i + 1}. ${text}`);
  });

  console.log('\n\n=== ALL OFFER TEXT ===');
  const uniqueAll = [...new Set(result.allOfferText)];
  uniqueAll.slice(0, 15).forEach((text, i) => {
    console.log(`\n${i + 1}. ${text}`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findAllOffers();
