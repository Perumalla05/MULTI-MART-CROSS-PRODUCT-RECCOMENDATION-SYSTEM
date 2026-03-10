import playwright from 'playwright';

async function debugFlipkartOffersDetailed() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('\n🔍 Debugging Flipkart product page offers in detail\n');

  await page.goto('https://www.flipkart.com/oneplus-15r-5g-charcoal-black-256-gb/p/itmc1c624041ba6c', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Get full page text
  const fullText = await page.evaluate(() => document.body.innerText);
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log('=== SEARCHING FOR OFFER SECTION ===\n');

  // Find "Bank Offer" and print surrounding lines
  lines.forEach((line, i) => {
    if (line === 'Bank Offer' || line === 'Bank offer') {
      console.log(`\nFound "Bank Offer" at line ${i}:`);
      console.log('--- Context (10 lines before and after) ---');
      for (let j = Math.max(0, i - 10); j < Math.min(lines.length, i + 20); j++) {
        const marker = j === i ? '>>> ' : '    ';
        console.log(`${marker}${j}: ${lines[j]}`);
      }
      console.log('---\n');
    }
  });

  // Also search for specific offer patterns
  console.log('\n=== LINES WITH DISCOUNT/CASHBACK/EMI ===\n');
  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    if ((lower.includes('discount') || lower.includes('cashback') || 
         lower.includes('emi') || lower.includes('exchange')) &&
        line.length > 20 && line.length < 200 &&
        !line.includes('₹')) {
      console.log(`${i}: ${line}`);
    }
  });

  await page.waitForTimeout(60000);
  await browser.close();
}

debugFlipkartOffersDetailed();
