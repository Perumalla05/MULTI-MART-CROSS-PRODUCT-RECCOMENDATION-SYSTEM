import playwright from 'playwright';

async function debugFlipkartProduct() {
  console.log('\n🔍 Debugging Flipkart product page\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Page title:', await page.title());

  // Search for offer sections
  const result = await page.evaluate(() => {
    const results = {
      offerElements: [],
      allText: []
    };

    // Look for elements with "offer" in class
    const offerEls = document.querySelectorAll('[class*="offer"], [class*="Offer"]');
    offerEls.forEach(el => {
      const text = el.innerText;
      if (text && text.length > 10 && text.length < 300) {
        results.offerElements.push({
          className: el.className,
          text: text.substring(0, 200)
        });
      }
    });

    // Search for Bank Offer text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent.trim();
      if (text.toLowerCase().includes('bank offer') || 
          text.toLowerCase().includes('no cost emi') ||
          text.toLowerCase().includes('exchange')) {
        const parent = walker.currentNode.parentElement;
        results.allText.push({
          text: text.substring(0, 150),
          parentClass: parent?.className || 'none'
        });
        
        if (results.allText.length >= 10) break;
      }
    }

    return results;
  });

  console.log('\n=== OFFER ELEMENTS ===');
  result.offerElements.slice(0, 5).forEach((item, i) => {
    console.log(`\n${i + 1}. Class: ${item.className.substring(0, 50)}`);
    console.log(`   Text: ${item.text}`);
  });

  console.log('\n\n=== TEXT WITH OFFERS ===');
  result.allText.forEach((item, i) => {
    console.log(`\n${i + 1}. ${item.text}`);
    console.log(`   Parent class: ${item.parentClass.substring(0, 50)}`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

debugFlipkartProduct();
