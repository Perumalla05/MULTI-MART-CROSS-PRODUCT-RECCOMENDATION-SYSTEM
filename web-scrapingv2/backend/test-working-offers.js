import playwright from 'playwright';

async function testWorkingOffers() {
  console.log('\n🔍 Testing offer extraction with .offers-items\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const offers = [];
  const seenOffers = new Set();

  // EMI
  const emiText = await page.evaluate(() => {
    const emiEl = document.querySelector('[id*="emi"]');
    return emiEl ? emiEl.innerText : '';
  });
  
  if (emiText && emiText.toLowerCase().includes('no cost emi available')) {
    offers.push('No Cost EMI available');
    console.log('✅ No Cost EMI available');
  }

  // Offers
  const offerItems = await page.$$('.offers-items');
  console.log(`\nFound ${offerItems.length} .offers-items elements\n`);
  
  for (const item of offerItems) {
    const text = await item.evaluate(node => node.innerText);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (const line of lines) {
      if (line.length > 20 && line.length < 250) {
        const lower = line.toLowerCase();
        
        const isOffer = 
          lower.includes('upto') || lower.includes('up to') ||
          (lower.includes('discount') && lower.includes('₹')) ||
          (lower.includes('cashback') && lower.includes('₹')) ||
          lower.includes('emi interest savings');
        
        const isNoise = 
          lower === 'offers' || lower === 'no cost emi' || 
          lower === 'bank offer' || lower === 'cashback' ||
          /^\d+\s+offers?$/i.test(line);
        
        if (isOffer && !isNoise && !seenOffers.has(line)) {
          seenOffers.add(line);
          offers.push(line);
          console.log(`✅ ${line}`);
        }
      }
    }
  }

  console.log(`\n📊 Total: ${offers.length} offers\n`);

  await page.waitForTimeout(30000);
  await browser.close();
}

testWorkingOffers();
