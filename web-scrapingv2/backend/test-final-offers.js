import playwright from 'playwright';

async function testFinalOfferExtraction() {
  console.log('\n🔍 Testing final offer extraction\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const offers = [];
  const seenOffers = new Set();

  // Extract EMI
  const emiText = await page.evaluate(() => {
    const emiEl = document.querySelector('#emi-text, [id*="emi"]');
    return emiEl ? emiEl.innerText : '';
  });
  
  if (emiText && emiText.toLowerCase().includes('no cost emi')) {
    offers.push('No Cost EMI available');
  }

  // Extract offers
  const offerElements = await page.$$('#sopp_feature_div .a-section, #apex_offerDisplay_desktop .a-section');
  console.log(`Found ${offerElements.length} offer elements\n`);
  
  for (const el of offerElements) {
    const text = await el.evaluate(node => node.innerText || node.textContent);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (const line of lines) {
      if (line.length > 20 && line.length < 200) {
        const lower = line.toLowerCase();
        
        const isOffer = 
          (lower.includes('upto') || lower.includes('up to')) ||
          lower.includes('discount') || lower.includes('cashback') ||
          lower.includes('emi interest savings') || lower.includes('no cost emi') ||
          lower.includes('bank offer') || lower.includes('exchange');
        
        const isNoise = 
          lower === 'offers' || lower === 'no cost emi' || lower === 'bank offer' ||
          lower === 'cashback' || lower.includes('view all') ||
          /^\d+\s+offers?$/i.test(line) || lower.includes('see more');
        
        if (isOffer && !isNoise && !seenOffers.has(line)) {
          seenOffers.add(line);
          offers.push(line);
          console.log(`✅ ${line}`);
        }
      }
    }
  }

  console.log(`\n📊 Total offers extracted: ${offers.length}\n`);
  offers.forEach((offer, i) => {
    console.log(`${i + 1}. ${offer}`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

testFinalOfferExtraction();
