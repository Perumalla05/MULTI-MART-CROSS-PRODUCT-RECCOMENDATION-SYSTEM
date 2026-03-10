import { chromium } from 'playwright';

const query = process.argv[2] || 'oneplus 15r';
console.log(`Debugging Flipkart offers for: "${query}"\n`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-IN'
});

const page = await context.newPage();

// First find a product URL
await page.goto(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const items = await page.$$('[data-id]');
if (items.length === 0) { console.log('No items found'); await browser.close(); process.exit(); }

const firstItem = items[0];
const linkEl = await firstItem.$('a');
const href = linkEl ? await linkEl.getAttribute('href') : null;
if (!href) { console.log('No link found'); await browser.close(); process.exit(); }

const productUrl = href.startsWith('http') ? href : `https://www.flipkart.com${href}`;
console.log('Product URL:', productUrl.substring(0, 150));

// Now visit the product page
await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const bodyText = await page.evaluate(() => document.body.innerText);
const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Find offer-related sections
console.log('\n=== Lines containing offer keywords ===');
const offerKeywords = ['bank offer', 'cashback', 'exchange', 'emi', 'coupon', 'discount', 'off on'];
for (let i = 0; i < lines.length; i++) {
  const lower = lines[i].toLowerCase();
  if (offerKeywords.some(k => lower.includes(k)) && lines[i].length > 5 && lines[i].length < 250) {
    console.log(`[${i}] ${lines[i]}`);
    // Show context: next 2 lines
    if (i + 1 < lines.length) console.log(`  -> [${i+1}] ${lines[i+1]}`);
    if (i + 2 < lines.length) console.log(`  -> [${i+2}] ${lines[i+2]}`);
    console.log('');
  }
}

// Also look for specific patterns
console.log('\n=== Lines containing ₹ and "off" ===');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('₹') && line.toLowerCase().includes('off') && line.length < 200) {
    console.log(`[${i}] ${line}`);
  }
}

// Look for the offers section specifically
console.log('\n=== Looking for "Offers" / "Bank Offers" section ===');
let inOffers = false;
let offerLines = 0;
for (let i = 0; i < lines.length; i++) {
  const lower = lines[i].toLowerCase();
  if (lower === 'offers' || lower === 'bank offers' || lower === 'available offers') {
    inOffers = true;
    console.log(`--- Section start at [${i}]: "${lines[i]}" ---`);
    continue;
  }
  if (inOffers) {
    console.log(`[${i}] ${lines[i]}`);
    offerLines++;
    if (offerLines > 30 || lower.includes('delivery') || lower.includes('highlights') || lower.includes('specification')) {
      console.log('--- Section end ---');
      inOffers = false;
      offerLines = 0;
    }
  }
}

await browser.close();
