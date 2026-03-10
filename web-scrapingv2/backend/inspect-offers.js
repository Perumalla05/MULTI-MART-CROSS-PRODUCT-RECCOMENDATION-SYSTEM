import playwright from 'playwright';

async function inspectOffers() {
  console.log('🔍 Inspecting Amazon product page for offers...\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Page title:', await page.title());
  console.log('\n--- Searching for offer-related IDs and classes ---\n');

  // Look for common offer-related elements
  const searchTerms = ['offer', 'promo', 'deal', 'discount', 'bank', 'emi', 'coupon', 'cashback'];
  
  for (const term of searchTerms) {
    const elements = await page.$$(`[id*="${term}"], [class*="${term}"]`);
    if (elements.length > 0) {
      console.log(`\n✅ Found ${elements.length} elements with "${term}":`);
      for (let i = 0; i < Math.min(3, elements.length); i++) {
        const id = await elements[i].getAttribute('id');
        const className = await elements[i].getAttribute('class');
        const text = (await elements[i].textContent()).trim().substring(0, 100);
        console.log(`  - ID: ${id || 'none'}, Class: ${className || 'none'}`);
        console.log(`    Text: "${text}..."`);
      }
    }
  }

  console.log('\n\n--- Looking for specific sections ---\n');

  // Check specific known sections
  const sections = [
    '#apex_desktop',
    '#corePrice_desktop',
    '#corePriceDisplay_desktop_feature_div',
    '#applicablePromotionList',
    '#promoPriceBlockMessage_feature_div',
    '#sopp_feature_div',
    '#buybox',
    '#desktop_qualifiedBuyBox'
  ];

  for (const selector of sections) {
    const el = await page.$(selector);
    if (el) {
      const text = (await el.textContent()).trim();
      console.log(`✅ ${selector}:`);
      console.log(`   ${text.substring(0, 200)}...\n`);
    }
  }

  console.log('\n✅ Inspection complete. Browser stays open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

inspectOffers();
