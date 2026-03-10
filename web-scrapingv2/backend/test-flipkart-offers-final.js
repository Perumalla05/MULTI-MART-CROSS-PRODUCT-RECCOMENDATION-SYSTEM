import playwright from 'playwright';

async function testFlipkartOffers() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const productUrl = 'https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c';
  
  console.log('\n🔍 Testing Flipkart offer extraction\n');
  console.log('URL:', productUrl);

  await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('\n=== Looking for "Bank offers" section ===\n');

  let inOfferSection = false;
  let offerCount = 0;
  const offers = [];
  const seenOffers = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (lower === 'bank offers') {
      inOfferSection = true;
      console.log(`✅ Found "Bank offers" at line ${i}\n`);
      continue;
    }

    if (inOfferSection && (lower.includes('delivery') || lower.includes('highlights') || offerCount > 25)) {
      console.log(`\n⛔ End of section at line ${i}\n`);
      break;
    }

    if (inOfferSection) {
      if (line.includes('•') && !lower.includes('apply')) {
        if (i + 1 < lines.length && lines[i + 1].includes('₹') && lines[i + 1].includes('off')) {
          const offerText = `${line} - ${lines[i + 1]}`;
          if (!seenOffers.has(offerText)) {
            seenOffers.add(offerText);
            offers.push(offerText);
            console.log(`✅ ${offerText}`);
          }
        }
      }
      offerCount++;
    }
  }

  console.log(`\n📊 Total offers: ${offers.length}\n`);

  await page.waitForTimeout(30000);
  await browser.close();
}

testFlipkartOffers();
