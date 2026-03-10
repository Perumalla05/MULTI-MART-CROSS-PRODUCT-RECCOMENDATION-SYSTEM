import playwright from 'playwright';

async function debugFlipkart() {
  console.log('\n🔍 Debugging Flipkart search page\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.flipkart.com/search?q=oneplus+15r', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const containers = await page.$$('[data-id]');
  console.log(`Found ${containers.length} [data-id] containers\n`);

  if (containers.length > 0) {
    console.log('=== FIRST PRODUCT ===\n');
    const first = containers[0];
    const html = await first.innerHTML();
    
    console.log('HTML (first 1500 chars):');
    console.log(html.substring(0, 1500));
    console.log('\n...\n');

    // Title
    const img = await first.$('img');
    const title = img ? await img.getAttribute('alt') : 'NO TITLE';
    console.log(`Title: ${title}\n`);

    // Prices
    const priceMatches = html.match(/₹([\d,]+)/g);
    console.log(`Price matches: ${priceMatches ? priceMatches.join(', ') : 'NONE'}\n`);

    // Look for offer text
    const offerKeywords = ['Bank Offer', 'No Cost EMI', 'Exchange', 'Special Price', 'off'];
    console.log('Searching for offer keywords in HTML:');
    offerKeywords.forEach(keyword => {
      if (html.includes(keyword)) {
        console.log(`✅ Found: ${keyword}`);
      }
    });

    // Try to get text content
    const text = await first.evaluate(node => node.innerText);
    console.log('\n=== INNER TEXT ===');
    console.log(text.substring(0, 500));
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

debugFlipkart();
