import playwright from 'playwright';

async function findExchangeSection() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in/dp/B0FZSWZZW2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n🔍 Finding exchange offer section...\n');

  const result = await page.evaluate(() => {
    // Find "With Exchange" or "Without Exchange" text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const matches = [];
    
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent.trim();
      if (text === 'With Exchange' || text === 'Without Exchange') {
        let parent = walker.currentNode.parentElement;
        
        // Go up 5 levels to find container
        for (let i = 0; i < 5 && parent; i++) {
          matches.push({
            level: i,
            tag: parent.tagName,
            id: parent.id,
            className: parent.className.substring(0, 100),
            text: parent.innerText.substring(0, 300)
          });
          parent = parent.parentElement;
        }
        break;
      }
    }
    
    return matches;
  });

  if (result.length > 0) {
    console.log('Found exchange section hierarchy:\n');
    result.forEach(r => {
      console.log(`Level ${r.level}: <${r.tag}>`);
      console.log(`  ID: ${r.id || 'none'}`);
      console.log(`  Class: ${r.className || 'none'}`);
      console.log(`  Text preview: ${r.text.substring(0, 100)}...\n`);
    });
  } else {
    console.log('❌ Exchange section not found');
  }

  // Also check for trade-in section
  const tradeIn = await page.$('#trade-in, [id*="trade"], [id*="exchange"]');
  if (tradeIn) {
    const text = await tradeIn.evaluate(node => node.innerText);
    console.log('\n=== TRADE-IN/EXCHANGE SECTION ===');
    console.log(text.substring(0, 500));
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

findExchangeSection();
