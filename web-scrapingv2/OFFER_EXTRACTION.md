# Offer Extraction Feature

## Overview
The system now extracts detailed offers from individual product pages on Amazon.

## How It Works

### 1. Search Page Scraping
- Scrapes product listings from search results
- Extracts basic info: title, price, MRP, image, URL
- Collects initial offers visible on search page (if any)

### 2. Product Page Visit (Optional)
- Controlled by `EXTRACT_OFFERS_FROM_PRODUCT_PAGE=true` in .env
- Visits first N products (default: 5, set via `MAX_PRODUCT_PAGES_TO_VISIT`)
- Extracts detailed offers from product page

### 3. Offer Extraction Logic

**Selectors Used:**
- `.offers-items` - Main offer containers
- `[id*="emi"]` - EMI information

**Extracted Offers:**
- ✅ No Cost EMI availability
- ✅ EMI interest savings (e.g., "Upto ₹2,292.85 EMI interest savings")
- ✅ Bank offers (e.g., "Upto ₹2,000.00 discount on select Credit Cards")
- ✅ Cashback offers (e.g., "Upto ₹1,439.00 cashback as Amazon Pay Balance")

**Filtering:**
- Excludes headers ("Offers", "Bank Offer", "Cashback")
- Excludes truncated text (ending with …)
- Excludes noise like "2 offers", "View all"
- Only includes text with actual monetary values or specific offer descriptions

## Configuration

### Enable/Disable Feature

```env
# Enable product page offer extraction
EXTRACT_OFFERS_FROM_PRODUCT_PAGE=true

# Number of products to visit for detailed offers (default: 5)
MAX_PRODUCT_PAGES_TO_VISIT=5
```

### Performance Impact

**With feature enabled:**
- Adds ~2-3 seconds per product page visited
- For 5 products: adds ~10-15 seconds to total scrape time
- Timeout is 60 seconds, so safe for up to ~15 products

**Recommendation:**
- Keep `MAX_PRODUCT_PAGES_TO_VISIT` between 3-10
- Higher values increase accuracy but slow down response time

## Testing

### Test Offer Extraction
```bash
cd backend
node test-working-offers.js
```

### Test Full Scraper
```bash
# Start backend
npm run dev

# In another terminal, test API
curl "http://localhost:3000/api/search?q=oneplus+15r"
```

## Example Output

```json
{
  "title": "OnePlus 15R | 12GB+256GB",
  "basePrice": 47999,
  "mrp": 54999,
  "rawOffers": [
    "No Cost EMI available",
    "Upto ₹2,292.85 EMI interest savings on select Credit Cards, Bajaj Finserv EMI cards",
    "Upto ₹2,000.00 discount on select Credit Cards, Debit Cards",
    "Upto ₹1,439.00 cashback as Amazon Pay Balance when you pay with Amazon Pay ICICI Bank Credit Cards"
  ]
}
```

## Troubleshooting

### No offers extracted
- Check if product page has offers section
- Verify `.offers-items` selector still works
- Run `node find-offer-parent.js` to inspect structure

### Timeout errors
- Reduce `MAX_PRODUCT_PAGES_TO_VISIT`
- Increase `SCRAPER_TIMEOUT` in .env
- Check network speed

### Duplicate offers
- System filters truncated text (ending with …)
- Uses Set to avoid exact duplicates
- If still seeing duplicates, check offer text format

## Future Enhancements

1. **Parallel product page visits** - Visit multiple pages concurrently
2. **Offer parsing** - Extract structured data (amount, type, conditions)
3. **Price estimation** - Calculate effective price based on deterministic offers
4. **Offer caching** - Cache offers per product ASIN
5. **Flipkart/Croma support** - Extend to other platforms
