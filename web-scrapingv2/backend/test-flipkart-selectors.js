import { chromium } from 'playwright';

async function testFlipkart() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://www.flipkart.com/search?q=oneplus+15r');
  await page.waitForTimeout(3000);
  
  console.log('\n=== Found Products ===\n');
  
  const items = await page.$$('[data-id]');
  console.log(`Total items: ${items.length}`);
  
  // Get HTML of first item to see structure
  if (items.length > 0) {
    const firstItemHTML = await items[0].innerHTML();
    console.log('\n=== First Item HTML ===\n');
    console.log(firstItemHTML.substring(0, 1500));
    console.log('\n...');
  }
  
  await browser.close();
}

testFlipkart();
