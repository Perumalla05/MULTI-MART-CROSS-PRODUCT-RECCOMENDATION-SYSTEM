import { chromium } from 'playwright';

// Simulate the new extractOffersFromProductPage logic
async function extractOffers(page, productUrl) {
  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const offers = [];
  const seenOffers = new Set();
  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Coupons
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase() === 'coupons' && i + 1 < lines.length) {
      const amountLine = lines[i + 1];
      if (/₹[\d,]+\s*off/i.test(amountLine)) {
        const desc = i + 2 < lines.length ? lines[i + 2] : '';
        const offerText = desc.toLowerCase().includes('coupon')
          ? `Coupon: ${amountLine} - ${desc}`
          : `Coupon: ${amountLine}`;
        if (!seenOffers.has(offerText)) { seenOffers.add(offerText); offers.push(offerText); }
      }
    }
  }

  // Bank offers
  let inBankOffers = false;
  let lineCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower === 'bank offers') { inBankOffers = true; lineCount = 0; continue; }
    if (inBankOffers) {
      lineCount++;
      if (lineCount > 60 || lower.includes('delivery') || lower.includes('highlights') ||
          lower.includes('specification') || lower === 'emi') {
        inBankOffers = false; continue;
      }
      const amountMatch = lines[i].match(/^₹([\d,]+)\s*off$/i);
      if (amountMatch) {
        let offerType = '';
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prev = lines[j].toLowerCase();
          if (prev.includes('credit card') || prev.includes('debit card') ||
              prev.includes('upi') || prev.includes('cashback') || prev.includes('net banking')) {
            offerType = lines[j];
            if (j > 0 && !['apply', 'best value for you'].includes(lines[j-1].toLowerCase()) &&
                lines[j-1].length < 40 && lines[j-1].length > 2) {
              offerType = `${lines[j-1]} ${offerType}`;
            }
            break;
          }
        }
        const offerText = offerType ? `${offerType} - ${lines[i]}` : `Bank offer - ${lines[i]}`;
        if (!seenOffers.has(offerText)) { seenOffers.add(offerText); offers.push(offerText); }
      }
    }
  }

  // No Cost EMI
  for (const line of lines) {
    if (line.toLowerCase().includes('no cost emi') && !seenOffers.has('No Cost EMI available')) {
      seenOffers.add('No Cost EMI available');
      offers.push('No Cost EMI available');
      break;
    }
  }

  // Exchange
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('exchange') && lines[i].includes('₹') && lines[i].length < 150) {
      if (!seenOffers.has(lines[i])) { seenOffers.add(lines[i]); offers.push(lines[i]); }
    }
    if (lower === 'exchange' || lower.includes('exchange offer')) {
      if (i + 1 < lines.length && /₹[\d,]+/.test(lines[i + 1])) {
        const offerText = `Exchange: ${lines[i + 1]}`;
        if (!seenOffers.has(offerText)) { seenOffers.add(offerText); offers.push(offerText); }
      }
    }
  }

  return offers.slice(0, 10);
}

// Simulate parseOffers from priceEngine
function extractAmount(text) {
  const match = text.match(/₹\s?([\d,]+(?:\.\d+)?)/);
  if (match) return Math.round(parseFloat(match[1].replace(/,/g, '')));
  const uptoMatch = text.match(/up\s*to\s+([\d,]+(?:\.\d+)?)\s*off/i);
  if (uptoMatch) return Math.round(parseFloat(uptoMatch[1].replace(/,/g, '')));
  return 0;
}

function parseOffers(rawOffers) {
  const parsed = { exchange: 0, bankDiscount: 0, coupon: 0, cashback: 0, emiSavings: 0, hasNoCostEmi: false };
  for (const offer of rawOffers) {
    const lower = offer.toLowerCase();
    const amount = extractAmount(offer);
    if (lower.includes('no cost emi') && !lower.includes('savings')) parsed.hasNoCostEmi = true;
    else if (lower.includes('emi') && lower.includes('savings') && amount > 0) parsed.emiSavings = Math.max(parsed.emiSavings, amount);
    else if (lower.includes('cashback') && amount > 0) parsed.cashback = Math.max(parsed.cashback, amount);
    else if (lower.includes('exchange') && amount > 0) parsed.exchange = Math.max(parsed.exchange, amount);
    else if (lower.includes('coupon') && amount > 0) parsed.coupon = Math.max(parsed.coupon, amount);
    else if ((lower.includes('bank') || lower.includes('instant discount') || lower.includes('credit card') || lower.includes('debit card')) && amount > 0) parsed.bankDiscount = Math.max(parsed.bankDiscount, amount);
    else if (amount >= 10000 && /up\s*to/i.test(lower) && lower.includes('off')) parsed.exchange = Math.max(parsed.exchange, amount);
  }
  return parsed;
}

// Run
const query = process.argv[2] || 'oneplus 15r';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  viewport: { width: 1920, height: 1080 }, locale: 'en-IN'
});
const page = await context.newPage();

// Get product URL
await page.goto(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const items = await page.$$('[data-id]');
const linkEl = await items[0].$('a');
const href = await linkEl.getAttribute('href');
const productUrl = href.startsWith('http') ? href : `https://www.flipkart.com${href}`;

console.log(`Testing Flipkart offers for: "${query}"`);
console.log(`Product: ${productUrl.substring(0, 100)}\n`);

const offers = await extractOffers(page, productUrl);
console.log('Extracted offers:');
offers.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));

const parsed = parseOffers(offers);
console.log('\nParsed:', JSON.stringify(parsed, null, 2));

console.log('\nPrice options would be generated for:');
if (parsed.cashback > 0) console.log(`  - With Cashback: -₹${parsed.cashback}`);
if (parsed.bankDiscount > 0) console.log(`  - With Card Discount: -₹${parsed.bankDiscount}`);
if (parsed.coupon > 0) console.log(`  - With Coupon: -₹${parsed.coupon}`);
if (parsed.exchange > 0) console.log(`  - With Exchange: -₹${parsed.exchange}`);
if (parsed.hasNoCostEmi) console.log(`  - No Cost EMI available`);

await browser.close();
