import playwright from 'playwright';

async function findRelianceSelector() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const searchUrl = 'https://www.reliancedigital.in/products?q=oneplus%2015r&page_no=1&page_size=12&page_type=number';
  
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(8000); // Wait longer for JS to load

  console.log('\n🔍 Finding product containers\n');

  // Look for elements containing price
  const result = await page.evaluate(() => {
    const results = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
      const text = el.innerText || '';
      if (text.includes('OnePlus 15R') && text.includes('₹47,999')) {
        results.push({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          text: text.substring(0, 200)
        });
      }
    });
    
    return results.slice(0, 5);
  });

  console.log('Elements containing product info:');
  result.forEach((item, i) => {
    console.log(`\n${i + 1}. <${item.tag}> class="${item.className.substring(0, 80)}" id="${item.id}"`);
    console.log(`   Text: ${item.text}`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findRelianceSelector();
