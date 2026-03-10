import playwright from 'playwright';

async function findOfferParent() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n🔍 Finding offer parent containers...\n');

  const result = await page.evaluate(() => {
    // Find element containing "Upto ₹2,000.00 discount"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const matches = [];
    
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent.trim();
      if (text.includes('Upto ₹') && text.includes('discount')) {
        let parent = walker.currentNode.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          matches.push({
            level: i,
            tag: parent.tagName,
            id: parent.id,
            className: parent.className,
            text: text.substring(0, 100)
          });
          parent = parent.parentElement;
        }
        break;
      }
    }
    
    return matches;
  });

  console.log('Parent hierarchy for offer text:');
  result.forEach(r => {
    console.log(`\nLevel ${r.level}: <${r.tag}>`);
    console.log(`  ID: ${r.id || 'none'}`);
    console.log(`  Class: ${r.className.substring(0, 100) || 'none'}`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findOfferParent();
