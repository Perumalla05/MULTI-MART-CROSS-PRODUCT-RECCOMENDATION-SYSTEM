import { chromium } from 'playwright';

const query = process.argv[2] || 'nike air force 1';
console.log(`Testing Flipkart title extraction for: "${query}"`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-IN'
});
const page = await context.newPage();
await page.goto(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const items = await page.$$('[data-id]');
console.log(`Total [data-id] items: ${items.length}\n`);

let matched = 0;
const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '');
const queryTokens = normalize(query).split(/\s+/).filter(t => t.length > 2);

for (let i = 0; i < Math.min(items.length, 10); i++) {
  const item = items[i];
  const imgEl = await item.$('img');
  const imgAlt = imgEl ? await imgEl.getAttribute('alt') : '';

  const titleData = await item.evaluate(node => {
    const links = node.querySelectorAll('a[href*="/p/"]');
    const textNodes = node.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const brand = textNodes.length > 0 ? textNodes[0] : '';
    let productTitle = '';
    for (const link of links) {
      const text = link.textContent?.trim();
      if (text && text.length > 5 && !text.includes('₹') && !/^\d+%/.test(text)) {
        productTitle = text;
        break;
      }
    }
    const priceTexts = textNodes.filter(l => l.includes('₹'));
    return { brand, productTitle, priceTexts };
  });

  let title = imgAlt && imgAlt.length >= 5 ? imgAlt : null;
  if (!title && titleData.productTitle) {
    title = titleData.productTitle;
    if (titleData.brand && !title.toLowerCase().startsWith(titleData.brand.toLowerCase())) {
      title = `${titleData.brand} ${title}`;
    }
  }

  const titleNorm = normalize(title || '');
  const matches = queryTokens.every(t => titleNorm.includes(t));
  if (matches) matched++;

  console.log(`[${i}] ${matches ? 'MATCH' : 'SKIP '} | ${title || '(no title)'}`);
  console.log(`     Price: ${titleData.priceTexts[0] || '?'}`);
}

console.log(`\nMatched ${matched} of first 10 items for query "${query}"`);

await browser.close();
