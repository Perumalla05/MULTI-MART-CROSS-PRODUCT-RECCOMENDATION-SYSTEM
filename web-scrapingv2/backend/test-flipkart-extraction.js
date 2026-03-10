import playwright from 'playwright';

async function testFlipkartExtraction() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('\n🔍 Testing Flipkart offer extraction\n');

  const offers = [];
  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let inOfferSection = false;
  let offerCount = 0;
  const seenOffers = new Set();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    
    if (lower === 'bank offers') {
      inOfferSection = true;
      console.log(`✅ Found "Bank offers" at line ${i}\n`);
      continue;
    }
    
    if (inOfferSection && (lower.includes('delivery') || lower.includes('highlights') || offerCount > 20)) {
      console.log(`\n⛔ End of offer section at line ${i}: "${line}"\n`);
      break;
    }
    
    if (inOfferSection) {
      if ((line.includes('•') || line.includes('off') || lower.includes('cashback') || 
           lower.includes('emi') || lower.includes('exchange')) &&
          line.length > 5 && line.length < 150 &&
          !lower.includes('apply') && !lower.includes('view')) {
        
        let offerText = line;
        if (i + 1 < lines.length && lines[i + 1].includes('₹') && lines[i + 1].includes('off')) {
          offerText = `${line} - ${lines[i + 1]}`;
        }
        
        if (!seenOffers.has(offerText)) {
          seenOffers.add(offerText);
          offers.push(offerText);
          console.log(`✅ ${offerText}`);
        }
      }
      offerCount++;
    }
  }

  console.log(`\n📊 Total offers extracted: ${offers.length}\n`);

  await page.waitForTimeout(30000);
  await browser.close();
}

testFlipkartExtraction();
