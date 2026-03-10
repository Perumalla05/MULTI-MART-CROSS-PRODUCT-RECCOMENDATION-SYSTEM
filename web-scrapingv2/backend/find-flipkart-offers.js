import playwright from 'playwright';

async function findFlipkartOffers() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n🔍 Finding Flipkart offer details\n');

  // Look for the "Bank offers" section and get its parent
  const offers = await page.evaluate(() => {
    const results = [];
    
    // Find all list items (offers are usually in lists)
    const listItems = document.querySelectorAll('li, div[class*="row"]');
    
    listItems.forEach(item => {
      const text = item.innerText || item.textContent;
      if (text && text.length > 20 && text.length < 500) {
        const lower = text.toLowerCase();
        if (lower.includes('bank') || lower.includes('emi') || 
            lower.includes('exchange') || lower.includes('cashback')) {
          results.push({
            tag: item.tagName,
            className: item.className.substring(0, 80),
            text: text.substring(0, 250)
          });
        }
      }
    });
    
    return results.slice(0, 10);
  });

  console.log('=== OFFER ITEMS ===\n');
  offers.forEach((offer, i) => {
    console.log(`${i + 1}. <${offer.tag}> class="${offer.className}"`);
    console.log(`   ${offer.text}\n`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findFlipkartOffers();
