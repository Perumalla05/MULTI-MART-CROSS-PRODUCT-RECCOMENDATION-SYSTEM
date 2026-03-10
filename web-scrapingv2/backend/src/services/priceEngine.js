// Extract monetary value from an offer string (e.g. "Upto ₹5,000 off on Exchange" → 5000)
// Pass basePrice to enable percentage-based extraction (e.g. "Extra 10% off" → 0.1 * basePrice)
function extractAmount(text, basePrice = 0) {
  // Match ₹ followed by digits with optional commas and decimals
  const match = text.match(/₹\s?([\d,]+(?:\.\d+)?)/);
  if (match) return Math.round(parseFloat(match[1].replace(/,/g, '')));

  // Match "up to <number> off" pattern (no ₹ symbol, e.g. "Up to    45,000.00 off")
  const uptoMatch = text.match(/up\s*to\s+([\d,]+(?:\.\d+)?)\s*off/i);
  if (uptoMatch) return Math.round(parseFloat(uptoMatch[1].replace(/,/g, '')));

  // Match percentage discount and convert to rupee savings using basePrice
  if (basePrice > 0) {
    const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*off/i);
    if (pctMatch) return Math.round(basePrice * parseFloat(pctMatch[1]) / 100);
  }

  return 0;
}

// Parse raw offer strings into structured offer categories
// Order matters: check specific keywords (cashback, emi) BEFORE generic ones (bank, credit card)
function parseOffers(rawOffers, basePrice = 0) {
  const parsed = {
    exchange: 0,
    bankDiscount: 0,
    coupon: 0,
    cashback: 0,
    emiSavings: 0,
    hasNoCostEmi: false
  };

  if (!rawOffers || rawOffers.length === 0) return parsed;

  for (const offer of rawOffers) {
    const lower = offer.toLowerCase();
    const amount = extractAmount(offer, basePrice);

    if (lower.includes('no cost emi') && !lower.includes('savings')) {
      parsed.hasNoCostEmi = true;
    } else if (lower.includes('emi') && lower.includes('savings') && amount > 0) {
      parsed.emiSavings = Math.max(parsed.emiSavings, amount);
    } else if (lower.includes('cashback') && amount > 0) {
      parsed.cashback = Math.max(parsed.cashback, amount);
    } else if (lower.includes('exchange') && amount > 0) {
      parsed.exchange = Math.max(parsed.exchange, amount);
    } else if (lower.includes('coupon') && amount > 0) {
      parsed.coupon = Math.max(parsed.coupon, amount);
    } else if (
      (lower.includes('bank') || lower.includes('instant discount') ||
       lower.includes('credit card') || lower.includes('debit card') ||
       lower.includes('upi') ||
       (lower.includes('extra') && lower.includes('off')) ||
       (lower.includes('flat') && lower.includes('off'))) &&
      amount > 0
    ) {
      parsed.bankDiscount = Math.max(parsed.bankDiscount, amount);
    } else if (amount >= 10000 && /up\s*to/i.test(lower) && lower.includes('off')) {
      // Large "Up to X off" without specific keyword is likely exchange
      parsed.exchange = Math.max(parsed.exchange, amount);
    }
  }

  return parsed;
}

// Generate price option combinations from parsed offers
function generatePriceOptions(basePrice, parsed) {
  const options = [];

  // Base price is always an option
  options.push({ scenario: 'Base Price', price: basePrice, savings: 0 });

  // Individual offers
  if (parsed.bankDiscount > 0) {
    options.push({ scenario: 'With Card Discount', price: basePrice - parsed.bankDiscount, savings: parsed.bankDiscount });
  }

  if (parsed.coupon > 0) {
    options.push({ scenario: 'With Coupon', price: basePrice - parsed.coupon, savings: parsed.coupon });
  }

  if (parsed.exchange > 0) {
    options.push({ scenario: 'With Exchange', price: basePrice - parsed.exchange, savings: parsed.exchange });
  }

  if (parsed.cashback > 0) {
    options.push({ scenario: 'With Cashback', price: basePrice - parsed.cashback, savings: parsed.cashback });
  }

  if (parsed.emiSavings > 0) {
    options.push({ scenario: 'With EMI Savings', price: basePrice - parsed.emiSavings, savings: parsed.emiSavings });
  }

  // Combinations
  if (parsed.exchange > 0 && parsed.bankDiscount > 0) {
    const s = parsed.exchange + parsed.bankDiscount;
    options.push({ scenario: 'Exchange + Card Discount', price: basePrice - s, savings: s });
  }

  if (parsed.exchange > 0 && parsed.cashback > 0) {
    const s = parsed.exchange + parsed.cashback;
    options.push({ scenario: 'Exchange + Cashback', price: basePrice - s, savings: s });
  }

  if (parsed.exchange > 0 && parsed.coupon > 0) {
    const s = parsed.exchange + parsed.coupon;
    options.push({ scenario: 'Exchange + Coupon', price: basePrice - s, savings: s });
  }

  if (parsed.exchange > 0 && parsed.emiSavings > 0) {
    const s = parsed.exchange + parsed.emiSavings;
    options.push({ scenario: 'Exchange + EMI Savings', price: basePrice - s, savings: s });
  }

  // Sort by price ascending (best deal first)
  options.sort((a, b) => a.price - b.price);

  // Filter out options with negative or zero prices
  return options.filter(o => o.price > 0);
}

export function calculateEffectivePrice(product) {
  let effectivePrice = product.basePrice;

  // Only subtract deterministic flat discounts
  if (product.couponDiscount && typeof product.couponDiscount === 'number') {
    effectivePrice -= product.couponDiscount;
  }

  if (product.bankOffer && typeof product.bankOffer === 'number') {
    effectivePrice -= product.bankOffer;
  }

  // Add shipping if applicable
  if (product.shippingCost && typeof product.shippingCost === 'number') {
    effectivePrice += product.shippingCost;
  }

  return Math.max(0, effectivePrice);
}

export function enrichProductWithPrice(product) {
  const parsed = parseOffers(product.rawOffers, product.basePrice);
  const priceOptions = generatePriceOptions(product.basePrice, parsed);

  // Best effective price: lowest price option (includes all offer combinations)
  // Falls back to base price if no offers are available
  const effectivePrice = priceOptions.length > 0 ? priceOptions[0].price : product.basePrice;

  return {
    ...product,
    effectivePrice,
    savings: product.mrp ? product.mrp - product.basePrice : 0,
    priceOptions: priceOptions.length > 1 ? priceOptions : undefined
  };
}

export function findLowestPrices(products) {
  if (products.length === 0) {
    return { lowestBase: null, lowestEffective: null };
  }

  const enriched = products.map(enrichProductWithPrice);

  const lowestBase = enriched.reduce((min, p) => 
    p.basePrice < min.basePrice ? p : min
  );

  const lowestEffective = enriched.reduce((min, p) => 
    p.effectivePrice < min.effectivePrice ? p : min
  );

  return { lowestBase, lowestEffective, allProducts: enriched };
}
