import playwright from 'playwright';

const PRODUCT_URL = process.argv[2] || 'https://www.amazon.in/dp/B0FZSWZZW2';

async function testOfferExtraction() {
  console.log(`\n🔍 Testing offer extraction from product page\n`);
  console.log(`URL: ${PRODUCT_URL}\n`);

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('⏳ Loading product page...');
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✅ Page loaded\n');

    const offerSections = [
      { selector: '#promoPriceBlockMessage_feature_div', name: 'Promo Message' },
      { selector: '#couponsInBuybox_feature_div', name: 'Coupons' },
      { selector: '#apex_offerDisplay_single_desktop', name: 'Delivery Offers' },
      { selector: '#promotionMessageInsideBuyBox_feature_div', name: 'Promotion Message' },
      { selector: '#promoMessagingDiscountValue_feature_div', name: 'Discount Value' }
    ];

    console.log('📦 EXTRACTING OFFERS\n');

    const allOffers = [];
    for (const section of offerSections) {
      const elements = await page.$$(section.selector);
      if (elements.length > 0) {
        console.log(`\n--- ${section.name} (${elements.length} elements) ---`);
        
        for (const el of elements) {
          const text = (await el.textContent()).trim();
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          for (const line of lines.slice(0, 10)) {
            if (line.length > 15 && line.length < 200) {
              const lower = line.toLowerCase();
              const isOffer = 
                lower.includes('save') || lower.includes('off') || lower.includes('discount') ||
                lower.includes('cashback') || lower.includes('no cost emi') || 
                lower.includes('exchange') || lower.includes('bank offer') ||
                lower.includes('coupon') || lower.includes('free delivery');
              
              const isNoise = 
                lower.includes('details') || lower.includes('see more') ||
                lower.includes('select') || lower.includes('choose') ||
                /^\d+$/.test(line) || line.startsWith('₹');
              
              if (isOffer && !isNoise) {
                console.log(`✅ "${line}"`);
                allOffers.push(line);
              }
            }
          }
        }
      }
    }

    console.log(`\n\n📊 SUMMARY: Found ${allOffers.length} offers`);
    console.log('\nUnique offers:');
    const unique = [...new Set(allOffers)];
    unique.forEach((offer, i) => {
      console.log(`${i + 1}. ${offer}`);
    });

    console.log('\n✅ Test complete. Browser stays open for 30s...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testOfferExtraction();
