# API Interception Debugging Guide

## Why API Interception?

**Traditional DOM Scraping Problems:**
- Selectors break with every UI update
- Requires complex CSS/XPath selectors
- Slow (must wait for full page render)
- Fragile (class names change frequently)

**API Interception Benefits:**
- Internal APIs are versioned and stable
- JSON responses are structured
- Faster (no need to render full page)
- More reliable (APIs change less than UI)

## How to Find Internal APIs

### Method 1: Browser DevTools (Recommended)

1. **Open Target Website**
   ```
   Example: https://www.amazon.in
   ```

2. **Open DevTools**
   - Press F12 or Right-click → Inspect
   - Go to "Network" tab
   - Check "Preserve log"

3. **Filter Requests**
   - Click "XHR" or "Fetch" filter
   - This shows only AJAX/API calls

4. **Perform Search**
   - Search for a product (e.g., "iPhone 15")
   - Watch Network tab for new requests

5. **Identify API Calls**
   Look for requests with:
   - JSON response (check "Response" tab)
   - Product data in response
   - URL patterns like:
     - `/api/`
     - `/search`
     - `/query`
     - `/fetch`

6. **Analyze Response Structure**
   ```json
   {
     "products": [
       {
         "title": "iPhone 15",
         "price": 79900,
         "image": "https://..."
       }
     ]
   }
   ```

### Method 2: Playwright Request Logging

Create a debug script:

```javascript
// debug-api.js
import { chromium } from 'playwright';

async function debugAPIs() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log ALL requests
  page.on('request', request => {
    console.log('→', request.method(), request.url());
  });

  // Log ALL responses with details
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';

    console.log('←', status, url);

    // Only log JSON responses
    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        console.log('JSON Response:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Failed to parse JSON');
      }
    }
  });

  // Navigate and search
  await page.goto('https://www.flipkart.com');
  await page.fill('input[name="q"]', 'iPhone 15');
  await page.press('input[name="q"]', 'Enter');
  
  // Wait to see all API calls
  await page.waitForTimeout(5000);

  await browser.close();
}

debugAPIs();
```

Run:
```bash
cd backend
node debug-api.js
```

## Platform-Specific API Patterns

### Amazon India

**Search API Pattern:**
```
URL: https://www.amazon.in/s/query?...
Method: GET
Response: JSON with product listings
```

**Key Response Fields:**
```json
{
  "products": [
    {
      "asin": "B0...",
      "title": "...",
      "price": { "value": 79900 },
      "image": "..."
    }
  ]
}
```

**Interception Code:**
```javascript
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/s/query') || url.includes('search-alias')) {
    try {
      const data = await response.json();
      // Parse data.products
    } catch (e) {}
  }
});
```

### Flipkart

**Search API Pattern:**
```
URL: https://www.flipkart.com/api/3/page/fetch
Method: POST
Response: JSON with RESPONSE.products array
```

**Key Response Fields:**
```json
{
  "RESPONSE": {
    "products": [
      {
        "productName": "...",
        "price": { "value": 79900 },
        "imageUrl": "..."
      }
    ]
  }
}
```

**Interception Code:**
```javascript
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/api/') && url.includes('page/fetch')) {
    try {
      const data = await response.json();
      if (data?.RESPONSE?.products) {
        // Parse data.RESPONSE.products
      }
    } catch (e) {}
  }
});
```

### Croma

**Note:** Croma may not have easily interceptable APIs. Use DOM fallback.

**DOM Scraping Pattern:**
```javascript
const items = await page.$$('.product-item');
for (const item of items) {
  const title = await item.$eval('.product-title', el => el.textContent);
  const price = await item.$eval('.price', el => el.textContent);
}
```

## Common Issues & Solutions

### Issue 1: API Not Captured

**Symptoms:**
- `apiResponseCaptured` flag stays false
- Logs show "API interception failed, used DOM fallback"

**Solutions:**

1. **Wait Longer**
   ```javascript
   await page.goto(url);
   await page.waitForTimeout(3000); // Wait for API calls
   ```

2. **Check URL Pattern**
   ```javascript
   // Log all URLs to find the right pattern
   page.on('response', response => {
     console.log(response.url());
   });
   ```

3. **Verify Response is JSON**
   ```javascript
   page.on('response', async response => {
     const contentType = response.headers()['content-type'];
     if (contentType?.includes('json')) {
       console.log('JSON response:', response.url());
     }
   });
   ```

### Issue 2: Response Parsing Fails

**Symptoms:**
- API captured but products array is empty
- Errors like "Cannot read property 'products' of undefined"

**Solutions:**

1. **Log Raw Response**
   ```javascript
   const data = await response.json();
   console.log('Raw API response:', JSON.stringify(data, null, 2));
   ```

2. **Check Response Structure**
   ```javascript
   // Flipkart example
   if (data?.RESPONSE?.products) {
     // Correct path
   }
   
   // Amazon example
   if (data?.products) {
     // Correct path
   }
   ```

3. **Handle Missing Fields**
   ```javascript
   const title = item.productName || item.title || '';
   const price = item.price?.value || item.price || 0;
   ```

### Issue 3: Rate Limited

**Symptoms:**
- 429 status codes
- Empty responses after first few requests
- "Access Denied" pages

**Solutions:**

1. **Add Delays**
   ```javascript
   await page.waitForTimeout(2000 + Math.random() * 1000);
   ```

2. **Reduce Concurrency**
   ```env
   # .env
   SCRAPER_CONCURRENT_LIMIT=1
   ```

3. **Rotate User Agents**
   ```javascript
   const userAgents = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...'
   ];
   
   const context = await browser.newContext({
     userAgent: userAgents[Math.floor(Math.random() * userAgents.length)]
   });
   ```

### Issue 4: API Changed

**Symptoms:**
- Previously working scraper now fails
- Different response structure

**Solutions:**

1. **Re-run Debug Script**
   ```bash
   node debug-api.js
   ```

2. **Update URL Pattern**
   ```javascript
   // Old
   if (url.includes('/api/search'))
   
   // New (if they changed endpoint)
   if (url.includes('/api/v2/search'))
   ```

3. **Update Response Parsing**
   ```javascript
   // Old
   const products = data.products;
   
   // New (if structure changed)
   const products = data.results.items;
   ```

## Testing Your Scraper

### Unit Test Template

```javascript
// test-amazon.js
import AmazonScraper from './src/scrapers/platforms/amazon.js';
import browserPool from './src/services/browserPool.js';

async function test() {
  console.log('Testing Amazon scraper...');
  
  await browserPool.initialize();
  const scraper = new AmazonScraper();
  const context = await browserPool.getContext('Amazon');
  
  const queries = ['iPhone 15', 'Samsung TV', 'Sony headphones'];
  
  for (const query of queries) {
    console.log(`\nSearching: ${query}`);
    const results = await scraper.execute(query, context);
    console.log(`Found ${results.length} products`);
    
    if (results.length > 0) {
      console.log('Sample product:', JSON.stringify(results[0], null, 2));
    }
  }
  
  await browserPool.shutdown();
}

test().catch(console.error);
```

Run:
```bash
cd backend
node test-amazon.js
```

## Best Practices

### 1. Always Have DOM Fallback

```javascript
async scrape(query, page) {
  let apiData = null;

  // Try API interception
  page.on('response', async (response) => {
    if (response.url().includes('/api/search')) {
      apiData = await response.json();
    }
  });

  await page.goto(searchUrl);
  await page.waitForTimeout(2000);

  // If API worked, use it
  if (apiData?.products) {
    return this.parseApiData(apiData.products);
  }

  // Fallback to DOM
  return this.parseDom(page);
}
```

### 2. Log Everything During Development

```javascript
page.on('response', async (response) => {
  const url = response.url();
  console.log('Response:', url);
  
  if (url.includes('api')) {
    try {
      const data = await response.json();
      console.log('API Data:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Not JSON');
    }
  }
});
```

### 3. Handle Errors Gracefully

```javascript
try {
  const data = await response.json();
  if (data?.products?.length > 0) {
    return this.parseApiData(data.products);
  }
} catch (error) {
  logger.warn('API parsing failed', { error: error.message });
  // Continue to DOM fallback
}
```

### 4. Version Your Scrapers

```javascript
export default class AmazonScraper extends BaseScraper {
  constructor() {
    super('Amazon');
    this.version = '2.0'; // Track scraper version
    this.lastUpdated = '2024-01-15';
  }
}
```

## Monitoring API Health

Add to your scraper:

```javascript
async scrape(query, page) {
  const metrics = {
    apiIntercepted: false,
    domFallback: false,
    responseTime: 0
  };

  const start = Date.now();

  // ... scraping logic ...

  metrics.responseTime = Date.now() - start;

  logger.info('Scraper metrics', {
    platform: this.platformName,
    ...metrics
  });

  return products;
}
```

Query metrics from logs:
```bash
grep "apiIntercepted.*false" backend/logs/combined.log | wc -l
```

## When to Use DOM vs API

**Use API Interception When:**
- ✅ API endpoints are discoverable
- ✅ Response structure is stable
- ✅ JSON parsing is straightforward
- ✅ API is not heavily protected

**Use DOM Scraping When:**
- ✅ No discoverable APIs
- ✅ API requires authentication
- ✅ API responses are encrypted
- ✅ DOM structure is stable

**Use Both (Recommended):**
- ✅ Try API first
- ✅ Fallback to DOM if API fails
- ✅ Best of both worlds
