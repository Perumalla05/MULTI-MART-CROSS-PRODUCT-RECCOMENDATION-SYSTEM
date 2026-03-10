import playwright from 'playwright';

async function debugOfferText() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const sections = [
    '#promoPriceBlockMessage_feature_div',
    '#couponsInBuybox_feature_div',
    '#apex_offerDisplay_single_desktop',
    '#promotionMessageInsideBuyBox_feature_div',
    '#promoMessagingDiscountValue_feature_div'
  ];

  for (const selector of sections) {
    console.log(`\n=== ${selector} ===`);
    const el = await page.$(selector);
    if (el) {
      const text = await el.textContent();
      console.log(`Length: ${text.length}`);
      console.log(`Text: "${text.substring(0, 500)}"`);
      
      // Try innerText instead
      const innerText = await el.evaluate(node => node.innerText);
      console.log(`\nInnerText: "${innerText.substring(0, 500)}"`);
    } else {
      console.log('NOT FOUND');
    }
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

debugOfferText();
