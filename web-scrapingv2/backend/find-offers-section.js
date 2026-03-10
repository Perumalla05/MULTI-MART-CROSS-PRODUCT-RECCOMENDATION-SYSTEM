import playwright from 'playwright';

async function findOffersSection() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n🔍 Finding offers section...\n');

  // Search for text "Offers" or "Bank Offer"
  const result = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const results = [];
    
    for (const el of allElements) {
      const text = el.innerText || '';
      if (text.includes('Bank Offer') || text.includes('Upto ₹')) {
        results.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: text.substring(0, 200)
        });
        
        if (results.length >= 5) break;
      }
    }
    
    return results;
  });

  console.log('Elements containing offers:');
  result.forEach((r, i) => {
    console.log(`\n${i + 1}. <${r.tag}>`);
    console.log(`   ID: ${r.id || 'none'}`);
    console.log(`   Class: ${r.className || 'none'}`);
    console.log(`   Text: ${r.text}...`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findOffersSection();
