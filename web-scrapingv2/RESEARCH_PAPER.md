# Real-Time Multi-Platform E-Commerce Price Aggregation and Comparison System for the Indian Market

> Comprehensive Technical Documentation for IEEE Research Paper

---

## Abstract

This paper presents the design, implementation, and evaluation of a real-time price aggregation system for Indian e-commerce platforms. The system autonomously collects product listings across three categories — electronics, fashion, and grocery — from twelve distinct e-commerce platforms including Amazon, Flipkart, Croma, Reliance Digital, Myntra, Ajio, Tata CLiQ, Zepto, Swiggy Instamart, Amazon Fresh, Flipkart Minutes, and their category-specific variants. The system employs a hybrid scraping strategy that combines browser automation via Playwright, direct REST API interception, and DOM parsing to overcome modern anti-bot mechanisms, JavaScript-rendered single-page applications, and platform-specific access controls. A location-aware architecture enables quick-commerce grocery platforms (Zepto, Swiggy Instamart, Flipkart Minutes) to deliver real-time hyperlocal inventory and pricing based on the user's GPS coordinates. Evaluation demonstrates successful product extraction from eleven of twelve platforms, with per-platform scrape times ranging from 1.5 to 105 seconds, and an end-to-end response latency under 3 minutes for cold searches and under 100ms for cached results.

**Keywords:** web scraping, price aggregation, e-commerce, Playwright, browser automation, anti-bot bypass, hyperlocal grocery, Indian e-commerce, REST API interception, React, Node.js

---

## 1. Introduction

### 1.1 Motivation

India's e-commerce ecosystem is characterized by extreme platform fragmentation. A consumer searching for a product must navigate at minimum four to six independent platforms — each with different pricing, discount structures, bank offer partnerships, and delivery timelines. In the grocery segment, the emergence of quick-commerce (10–15 minute delivery) platforms such as Zepto, Swiggy Instamart, and Flipkart Minutes adds a hyperlocal dimension: product availability and pricing vary by the user's delivery pincode or GPS coordinates.

No publicly available tool aggregates pricing across all three verticals (electronics, fashion, grocery) within a single unified interface for Indian consumers.

### 1.2 Problem Statement

The core technical challenges addressed by this system are:

1. **Heterogeneous data sources**: Twelve platforms with different architectures (server-rendered, SPA, REST APIs, GraphQL, BFF APIs)
2. **Anti-bot mechanisms**: Bot detection via browser fingerprinting, CAPTCHAs, JavaScript challenges, AWS WAF, and behavioral analysis
3. **Dynamic content**: JavaScript-rendered SPAs that yield empty DOM trees on raw HTTP fetch
4. **Location dependency**: Grocery platforms that gate product availability behind delivery pincode or GPS location
5. **Real-time requirement**: Users expect fresh pricing data on every search
6. **Schema normalization**: Eleven unique data formats that must be reduced to a single product schema

### 1.3 Contributions

- A production-grade multi-platform web scraping system targeting the Indian e-commerce market
- Novel hybrid scraping strategy combining API interception with DOM parsing and fallback mechanisms
- A location-aware scraping pipeline for quick-commerce grocery platforms using GPS geolocation injection
- Documented anti-bot bypass techniques effective against Chromium-fingerprinting and `sec-ch-ua` detection
- A React-based frontend with GPS auto-detection, reverse geocoding, and delivery time display

---

## 2. Related Work

### 2.1 Price Comparison Systems

Existing global price comparison tools (Google Shopping, PriceRunner, Camelcamelcamel) rely on merchant data feeds (XML/CSV) rather than live scraping. This approach is unsuitable for the Indian market where most platforms do not publish standardized product feeds. BuyHatke and PriceDekho offer partial Indian platform coverage but do not span grocery or fashion categories.

### 2.2 Web Scraping Research

Prior work on large-scale web scraping addresses: (a) detection evasion through browser fingerprint normalization (Vastel et al., 2018); (b) headless browser detection via JavaScript API gaps (Laperdrix et al., 2020); (c) crawling of JavaScript-heavy SPAs (Fazzini et al., 2019). Our system builds on these findings, specifically applying Client Hints (`sec-ch-ua`) spoofing to bypass Zepto's headless browser detection.

### 2.3 Quick-Commerce Systems

The architecture of hyperlocal quick-commerce delivery systems has been studied in the context of dark store optimization (Snoeck et al., 2022). Our work is the first to address the data collection challenge for these platforms: their location-gated APIs and WAF-protected search endpoints require a novel geolocation injection approach.

---

## 3. System Architecture

### 3.1 Overview

The system follows a three-tier architecture:

```
┌──────────────────────────────────────────────────────────────┐
│                     USER BROWSER                             │
│              React Frontend (Vite, port 5173)                │
│  SearchBar → ResultsGrid → ProductCard                       │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP GET /api/search
                               ▼
┌──────────────────────────────────────────────────────────────┐
│               EXPRESS API SERVER (Node.js, port 3000)        │
│  Middleware: CORS → Input Validator → Error Handler          │
│  Routes: GET /health, GET /api/search                        │
│  Services: Cache (Redis/in-memory), Database (optional)      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
        ┌─────────────────┐      ┌──────────────────┐
        │  Redis Cache    │      │  Scraper         │
        │  (15-min TTL)   │      │  Orchestrator    │
        └─────────────────┘      └────────┬─────────┘
                                          │
                         ┌────────────────┼────────────────┐
                         ▼                ▼                 ▼
               ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
               │  Browser     │  │  Direct API  │  │  Hybrid      │
               │  Automation  │  │  Fetch       │  │  (API +DOM)  │
               │  (Playwright)│  │  (Node.js)   │  │              │
               └──────────────┘  └──────────────┘  └──────────────┘
```

### 3.2 Component Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend UI | React | 18.2.0 | Component-based UI |
| Frontend Build | Vite | 5.0.8 | Fast HMR, dev proxy |
| Backend API | Express.js | 4.18.2 | HTTP server, routing |
| Browser Automation | Playwright | 1.40.0 | Headless Chromium control |
| Logging | Winston | 3.11.0 | Structured JSON logs |
| Caching | Redis | 4.6.11 | Optional result caching |
| Persistence | better-sqlite3 | 9.2.2 | Optional search history |
| Runtime | Node.js | ≥18 | ES Module support, native fetch |

### 3.3 Directory Structure

```
web-scrapingv2/
├── backend/
│   └── src/
│       ├── server.js                    ← Express app entry
│       ├── config/index.js              ← Unified config (concurrency, timeouts)
│       ├── routes/search.js             ← GET /api/search handler
│       ├── middleware/
│       │   ├── validator.js             ← Query, lat/lng validation
│       │   └── errorHandler.js          ← Global error boundary
│       ├── services/
│       │   ├── browserPool.js           ← Playwright context manager
│       │   ├── cache.js                 ← Redis wrapper (graceful degradation)
│       │   └── database.js              ← SQLite/PostgreSQL wrapper
│       ├── scrapers/
│       │   ├── base.js                  ← Abstract BaseScraper class
│       │   ├── orchestrator.js          ← Parallel scraper coordinator
│       │   └── platforms/
│       │       ├── amazon.js            ← Amazon India (electronics)
│       │       ├── amazonFresh.js       ← Amazon grocery (extends amazon.js)
│       │       ├── amazonFashion.js     ← Amazon fashion (extends amazon.js)
│       │       ├── flipkart.js          ← Flipkart (electronics)
│       │       ├── flipkartGrocery.js   ← Flipkart Minutes (extends flipkart.js)
│       │       ├── flipkartFashion.js   ← Flipkart fashion (extends flipkart.js)
│       │       ├── croma.js             ← Croma (REST API)
│       │       ├── reliancedigital.js   ← Reliance Digital (REST API)
│       │       ├── myntra.js            ← Myntra (Playwright DOM)
│       │       ├── ajio.js              ← Ajio (direct JSON API)
│       │       ├── tatacliq.js          ← Tata CLiQ (BFF API)
│       │       ├── zepto.js             ← Zepto (Playwright + API intercept)
│       │       └── instamart.js         ← Swiggy Instamart (Playwright + DOM)
│       └── utils/
│           ├── logger.js                ← Winston JSON logger
│           └── retry.js                 ← Exponential backoff retry
└── frontend/
    └── src/
        ├── App.jsx                      ← Root state, search orchestration
        ├── components/
        │   ├── SearchBar.jsx            ← Search input + GPS location UI
        │   ├── ResultsGrid.jsx          ← Platform tabs, product grid
        │   └── ProductCard.jsx          ← Individual product display
        └── services/
            └── api.js                   ← Backend HTTP client
```

---

## 4. Platform Coverage and Scraping Strategies

The system covers **12 platform variants** across **3 product categories**:

| Platform | Category | Scraping Method | Offers Extracted | Ratings |
|---|---|---|---|---|
| Amazon India | Electronics | Playwright DOM + product page | ✅ Bank, cashback, EMI, coupon | ✅ |
| Amazon Fresh | Grocery | Playwright DOM (extends Amazon) | ✅ (inherited) | ✅ |
| Amazon Fashion | Fashion | Playwright DOM (extends Amazon) | ✅ (inherited) | ✅ |
| Flipkart | Electronics | Playwright DOM + product page | ✅ Bank, coupon | ✅ |
| Flipkart Minutes | Grocery | Playwright DOM + GPS location | ✅ (inherited) | ✅ |
| Flipkart Fashion | Fashion | Playwright DOM (extends Flipkart) | ✅ (inherited) | ✅ |
| Croma | Electronics | Direct REST API | ❌ | ✅ |
| Reliance Digital | Electronics | Direct REST API | ❌ | ✅ |
| Myntra | Fashion | Playwright DOM | ❌ (N/A) | ✅ |
| Ajio | Fashion | Direct JSON API | ❌ (N/A) | ❌ |
| Tata CLiQ | Fashion | Direct BFF API | ❌ (N/A) | ✅ |
| Zepto | Grocery | Playwright + BFF API intercept | ❌ (N/A) | ✅ |
| Swiggy Instamart | Grocery | Playwright DOM + GPS | ❌ (N/A) | ❌ |

---

## 5. Implementation Details

### 5.1 Base Scraper Architecture

All scrapers extend a common `BaseScraper` abstract class that implements:

- **Template Method Pattern**: `execute()` orchestrates the lifecycle — open page, call `scrape()`, close page, log metrics
- **Retry with Exponential Backoff**: `scrapeWithRetry()` wraps `scrape()` in a configurable retry loop (max 3 retries, initial delay 5s, max delay 30s)
- **Timeout Race**: `Promise.race([scrapeWithRetry(), timeoutPromise()])` enforces a hard timeout per scraper
- **Standardized Product Schema**: `createProduct()` normalizes all platforms to a single object shape

```javascript
// Standardized product schema (base.js)
createProduct(data) {
  return {
    source,        // Platform name
    title,         // Normalized product title
    basePrice,     // Current selling price (₹)
    mrp,           // Maximum Retail Price (₹, nullable)
    discountPercent,
    productUrl,    // Deep link to product page
    imageUrl,
    rawOffers,     // Array of offer description strings
    rating,        // Float 0–5 (nullable)
    ratingCount,   // Integer (nullable)
    deliveryTime   // String: "~10 mins", "Same day" (nullable)
  };
}
```

### 5.2 Browser Pool (Playwright Context Management)

A singleton `BrowserPool` service manages one Chromium browser instance with per-platform persistent browser contexts:

```javascript
// browserPool.js — key configuration
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
  extraHTTPHeaders: {
    'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
    'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  }
});
```

**Context reuse** is a key performance optimization: each platform's context is created once and reused across all pages opened for that platform, preserving cookies, sessions, and headers.

### 5.3 Amazon Scraper

**Strategy**: Multi-page DOM scraping + individual product page visits for offer extraction.

**Search URL pattern**: `https://www.amazon.in/s?k={query}&i={department}`
Departments: `aps` (all), `grocery` (Amazon Fresh), `fashion` (Amazon Fashion)

**Product extraction**: Products are identified by CSS selector `[data-component-type="s-search-result"]`. For each product:
- Title: `h2 a span`, `img[alt]`
- Sponsored products (ads): extracted first from `[data-component-type="sp-sponsored-result"]`
- Price: `span.a-price-whole` + `span.a-price-fraction`
- MRP: `span.a-text-price span`
- Rating: `span[aria-label*="out of 5 stars"]`
- Rating count: `span[aria-label*="ratings"]`

**Offer extraction from product pages** (configurable, `extractOffersFromProductPage: true`):
- Navigates to each product URL (up to 15 products, 3 concurrent tabs)
- Parses `document.body.innerText` line-by-line
- Detects: "Bank Offers" section → extracts best offer per payment type (credit card, debit card, UPI)
- Detects: "Coupons" section → extracts coupon discount amounts
- Detects: "No Cost EMI" mentions
- Returns up to 10 offers per product

**Delivery time**: Not statically set for electronics; set to `"Same day"` for AmazonFresh.

### 5.4 Flipkart Scraper

**Strategy**: Multi-page DOM scraping with `[data-id]` product grid + per-product offer extraction.

**Search URL pattern**: `https://www.flipkart.com/search?q={query}[&marketplace=GROCERY][&page=N]`

**Product extraction**: Products identified by `[data-id]` attribute. Rating parsed with a custom regex handling Flipkart's concatenated format: `"4.75,286 Ratings & 283 Reviews"` → rating `4.7`, count `5286`.

**Offer extraction**: Parses product page `innerText` for:
- "Bank Offers" section with payment-type deduplication
- "Coupons" section (only first/best coupon)
- "No Cost EMI" mentions
- "Exchange" offers with ₹ amounts

**Flipkart Fashion** subclass: Extends Flipkart with fashion-specific `filterAccessories()` override that allows bags, belts, jewelry.

**Flipkart Minutes** (grocery) subclass:
- Appends `&marketplace=GROCERY` to search URL
- `onPageLoad()` hook: detects location prompt → calls Nominatim reverse geocoding API to resolve GPS coordinates to a 6-digit Indian pincode → fills the pincode input → submits
- `scrape()` override adds `deliveryTime: '~15 mins'` to all products

### 5.5 Croma Scraper

**Strategy**: Direct REST API call — no browser automation required.

**Endpoint**: `https://api.croma.com/searchservices/v2/search?q={query}&currentPage=0&pageSize=20`

**Response schema**:
```json
{
  "products": [{
    "name": "...",
    "price": { "formattedValue": "₹79,900" },
    "offerPrice": { "formattedValue": "₹74,990" },
    "url": "/product/...",
    "images": [{ "url": "//media.croma.com/..." }],
    "averageRating": 4.3,
    "numberOfRatings": 1247
  }]
}
```

This API is unauthenticated and returns structured JSON, making it the most reliable scraper in the system (no bot detection, no dynamic rendering).

### 5.6 Reliance Digital Scraper

**Strategy**: Direct REST API call.

**Endpoint**: `https://www.reliancedigital.in/rildigitalws/v2/rrldigital/cms/espot/productsSearch?searchTerm={query}&pageSize=20&currentPage=0`

Response includes `products[].name`, `prices.price.value`, `promotionalPrice.value`, `url`, `images[0].url`, `rating`, `reviewCount`.

Both Croma and Reliance Digital return data without authentication, headers, or sessions, enabling Node.js `fetch()` to retrieve them without Playwright.

### 5.7 Myntra Scraper

**Strategy**: Playwright DOM scraping of listing page.

**Search URL pattern**: `https://www.myntra.com/{hyphenated-query}?rawQuery={query}`

Myntra is a React SPA with server-side rendered product listing HTML. Products are in `li.product-base` elements. Extracted fields:
- Brand: `.product-brand`
- Product name: `.product-product`
- Price: `.product-discountedPrice`
- MRP: `.product-strike`
- Discount: `.product-discountPercentage` (e.g., `"(30% OFF)"`)
- Rating: `[class*="rating-count"], [class*="ratingsCount"]`
- Image: `img[src]` or `img[data-src]`

Human-like scrolling (`scrollToLoadMore`) is applied to trigger lazy-loading of product images.

### 5.8 Ajio Scraper

**Strategy**: Direct JSON API — no browser automation.

**Endpoint**: `https://www.ajio.com/api/search?query={q}&start=0&perPage=45&sortBy=relevance&format=json&pageType=search`

This Commerce-layer search API returns structured JSON without authentication. Key mapped fields:
- Brand: `fnlColorVariantData.brandName`
- Name: `name`
- Price: `price.value`
- MRP: `wasPriceData.value`
- Discount: `discountPercent` (string `"50% off"` → parsed to integer `50`)
- Image: `images.find(i => i.format === 'productGrid3ListingImage').url`
- URL: relative `url` prepended with base URL

CORS headers (`Origin`, `Referer`, `sec-fetch-*`) are spoofed to match a browser-originated request.

### 5.9 Tata CLiQ Scraper

**Strategy**: Direct BFF (Backend for Frontend) API call.

**Endpoint**: `https://searchbff.tatacliq.com/products/mpl/search?searchText={q}%3Arelevance%3AinStockFlag%3Atrue&channel=WEB&page=0&pageSize=40&typeID=all`

The search text format follows Solr query syntax: `{query}:relevance:inStockFlag:true`. Response is in `searchresult[]`. Notable quirks:
- `imageURL` is protocol-relative (`//img.tatacliq.com/...`) → prepend `https:`
- `webURL` is relative → prepend base URL
- `discountPercent` is a string `"0"` even when discount exists from price difference → recalculated from `mrpPrice - sellingPrice`

### 5.10 Zepto Scraper (Advanced)

The Zepto scraper is the most technically complex in the system, overcoming two distinct anti-bot layers.

**Challenge 1 — Headless Chrome Detection via Client Hints**

Zepto's React SPA reads the `sec-ch-ua` HTTP request header (Chrome UA Client Hints). In headless Playwright without explicit `extraHTTPHeaders`, this header is absent or identifies as `"HeadlessChrome"`, causing Zepto to return a near-empty DOM (3 elements vs. 880 expected).

**Fix**: Add `sec-ch-ua` to all Playwright contexts in `browserPool.js`:
```javascript
'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120", "Not-A.Brand";v="99"'
```

**Challenge 2 — BFF API Capture via Response Interception**

Zepto's search results are fetched from a backend BFF API during page load. Rather than parsing the DOM (which is complex and fragile), the scraper intercepts this network response:

```javascript
page.on('response', async (response) => {
  if (response.url().includes('user-search-service') &&
      response.url().includes('search') &&
      !response.url().includes('filter')) {
    bffData = await response.json();
  }
});
await page.goto(`https://www.zepto.com/search?query=${query}`);
// bffData is populated asynchronously as the page loads
```

**BFF Response Structure**:
```
response.layout[]
  → find widget where widgetId === 'PRODUCT_GRID'
  → .data.resolver.data.items[]
  → each item: .productResponse → product object
```

**Price Units**: All prices in the BFF response are in **paise** (1/100 of ₹). Division by 100 is required.

**Image CDN**: `https://cdn.zeptonow.com/production///tr:w-500,ar-3-4/{path}`

**Product URL**: `https://www.zepto.com/pn/{slug}/pvid/{variantId}`

**GPS Geolocation Injection**:
```javascript
await page.context().setGeolocation({ latitude: this.lat, longitude: this.lng });
await page.context().grantPermissions(['geolocation']);
// Then navigate — Zepto automatically uses injected coordinates
```

**Delivery time**: Static `'~10 mins'` per product.

### 5.11 Swiggy Instamart Scraper

**Strategy**: Playwright DOM scraping with GPS geolocation injection.

Instamart requires a delivery location before displaying products. The scraper:
1. Navigates to `https://www.swiggy.com/instamart` (home)
2. Sets browser geolocation via `page.context().setGeolocation()`
3. Attempts to click "Detect my location" or "Use current location" button
4. Navigates to `https://www.swiggy.com/instamart/search?query={query}`
5. Extracts product cards via CSS class-pattern selectors (`[class*="Product__"]`, `[class*="ItemCard"]`)

**Challenge**: Swiggy Instamart's search page is protected by AWS WAF, which issues a `awswaf_session_storage` token. The scraper may fail at the search navigation step if WAF challenges are not resolved. This platform remains partially functional — home page and location setup succeed, but search may be blocked.

### 5.12 Location-Aware Pipeline

The location pipeline handles GPS-based geolocation for all grocery platforms:

```
User Browser
  └─ navigator.geolocation.getCurrentPosition()
     └─ { lat, lng }
     └─ Nominatim reverse geocode → city name (for display)
     └─ Pass lat, lng to API as query params

Backend API (/api/search?lat=12.97&lng=77.73&category=grocery)
  └─ validator.js → validates lat/lng ranges (-90..90, -180..180)
  └─ Cache key includes rounded lat/lng (3 decimal places)
  └─ orchestrator.scrapeAll(query, category, pincode=null, lat, lng)

Orchestrator
  └─ zeptoScraper.lat = lat; zeptoScraper.lng = lng
  └─ instamartScraper.lat = lat; instamartScraper.lng = lng
  └─ flipkartGroceryScraper.lat = lat; flipkartGroceryScraper.lng = lng

Zepto: page.context().setGeolocation({ lat, lng }) before page.goto()
Instamart: setGeolocation() + click "Detect my location" button
Flipkart Minutes: Nominatim API → pincode → type into location prompt input
```

**Nominatim Reverse Geocoding for Flipkart Minutes**:
```javascript
const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
const data = await fetch(url).then(r => r.json());
const pincode = data.address?.postcode;  // e.g., "560066"
```

Since Flipkart's location modal requires a 6-digit pincode (not raw GPS), Nominatim is used on the backend to resolve GPS coordinates to a serviceable delivery pincode. This is more reliable than triggering Flipkart's own GPS detection flow, which gets stuck in a "detecting location" state under headless Playwright.

### 5.13 Scraper Orchestrator

The `ScraperOrchestrator` manages parallel execution with a configurable concurrency limit:

```javascript
async scrapeAll(query, category, pincode, lat, lng) {
  const scrapers = SCRAPERS_BY_CATEGORY[category];
  const chunks = chunkArray(scrapers, config.scraper.concurrentLimit);

  for (const chunk of chunks) {
    await Promise.all(chunk.map(scraper =>
      browserPool.getContext(scraper.platformName)
        .then(context => scraper.execute(query, context))
    ));
  }
}
```

**Category-to-Platform Mapping**:
```
electronics → [Amazon, Flipkart, Croma, RelianceDigital]
grocery     → [AmazonFresh, FlipkartMinutes, SwiggyInstamart, Zepto]
fashion     → [AmazonFashion, FlipkartFashion, Myntra, Ajio, TataCLiQ]
```

Grocery scrapers receive location injection (lat/lng and/or pincode) before execution. All scrapers run concurrently within each chunk, with results aggregated regardless of individual scraper failures.

---

## 6. Frontend Architecture

### 6.1 Component Hierarchy

```
App.jsx  (state: query, category, location, results, loading, error)
├── SearchBar.jsx
│   ├── Category selector (electronics / grocery / fashion)
│   ├── Search input + button
│   └── [grocery only] Location section
│       ├── "Detect my location" button
│       │   └── navigator.geolocation.getCurrentPosition()
│       │   └── Nominatim reverse geocode → city name
│       │   └── Shows: 🟢 Bengaluru (GPS auto-detected)
│       ├── "or" divider
│       └── "Enter pincode" toggle → 6-digit input
└── ResultsGrid.jsx
    └── ProductCard.jsx (×N)
        ├── Product image
        ├── Platform badge
        ├── Title (truncated at 2 lines)
        ├── Star rating + count
        ├── Discount badge (% OFF)
        ├── Price (bold) + MRP (strikethrough)
        ├── Offers section (💰 bank offers, cashback)
        ├── Price options (💵 effective prices)
        ├── Delivery time badge (🕐 ~10 mins)
        └── "View Product →" link
```

### 6.2 Location State Machine

```javascript
// location state in App.jsx
const [location, setLocation] = useState({ type: 'none' });

// type === 'none':    No location provided
// type === 'auto':   GPS detected { lat, lng, city }
// type === 'pincode': Manual pincode { pincode }

// Derived values passed to API:
const lat = location.type === 'auto' ? location.lat : null;
const lng = location.type === 'auto' ? location.lng : null;
const pincode = location.type === 'pincode' && /^\d{6}$/.test(location.pincode)
  ? location.pincode : null;
```

### 6.3 API Communication

```javascript
// api.js
export async function searchProducts(query, category, pincode, lat, lng) {
  let url = `/api/search?q=${encodeURIComponent(query)}&category=${category}`;
  if (pincode) url += `&pincode=${pincode}`;
  if (lat != null && lng != null) url += `&lat=${lat}&lng=${lng}`;
  return fetch(url).then(r => r.json());
}
```

### 6.4 Delivery Time Display

Products from grocery platforms include a `deliveryTime` field displayed as a colored badge:

| Platform | Delivery Time |
|---|---|
| Zepto | `~10 mins` |
| Swiggy Instamart | `~15 mins` |
| Flipkart Minutes | `~15 mins` |
| Amazon Fresh | `Same day` |

---

## 7. Anti-Bot Bypass Techniques

### 7.1 User-Agent Spoofing

All Playwright browser contexts present the full Chrome 120 user-agent string rather than Playwright's default headless identifier.

### 7.2 Client Hints (`sec-ch-ua`) Injection

Modern bot detection reads `sec-ch-ua` HTTP headers (Chrome UA Client Hints). HeadlessChrome omits or misreports these. Explicitly injecting correct `sec-ch-ua` headers resolved Zepto's DOM-empty issue:

```http
sec-ch-ua: "Chromium";v="120", "Google Chrome";v="120", "Not-A.Brand";v="99"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
```

**Impact**: Zepto DOM element count increased from 3 (detected headless) to 880+ (passed as regular browser).

### 7.3 Browser Geolocation API Injection

Playwright's `context.setGeolocation()` + `context.grantPermissions(['geolocation'])` injects GPS coordinates at the browser context level. When the page calls `navigator.geolocation.getCurrentPosition()`, Playwright returns the injected coordinates instead of showing a permission dialog.

**Limitation**: This only works when geolocation is set BEFORE navigation. Setting it after navigation requires the page to re-call the API. For Flipkart Minutes, the geolocation API call is triggered by clicking a UI button, but the response callback appears stuck in headless mode. The workaround (Nominatim API for pincode resolution) bypasses this entirely.

### 7.4 CORS Header Spoofing for Direct API Access

Several platforms expose unauthenticated JSON APIs intended for browser-originated XHR requests. These require CORS-specific headers:

```javascript
headers: {
  'Origin': 'https://www.ajio.com',
  'Referer': `https://www.ajio.com/search/?text=${query}`,
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin'
}
```

### 7.5 Human-Like Scrolling

All DOM-based scrapers call `scrollToLoadMore(page, N)` which incrementally scrolls the viewport to trigger lazy-loading of product images and React virtual DOM rendering.

### 7.6 Context Persistence

Browser contexts are reused across searches for the same platform. This preserves cookies and session tokens that platforms may issue to regular browsers, reducing the chance of detection on repeat visits.

---

## 8. Data Processing and Normalization

### 8.1 Product Schema Normalization

Despite eleven different source data formats, all scrapers produce identical output via `createProduct()`. Key normalization steps:

- **Price strings to floats**: `"₹1,24,990"` → `124990.0`
- **Discount from price difference**: When `mrp > price`, compute `((mrp - price) / mrp) * 100`
- **Protocol-relative image URLs**: `"//img.tatacliq.com/..."` → `"https://img.tatacliq.com/..."`
- **Relative product URLs**: `/product/...` → `https://www.platform.com/product/...`
- **Price in paise (Zepto)**: `discountedSellingPrice / 100` for rupee conversion
- **Discount strings**: Ajio `"50% off"` → regex extract `50`

### 8.2 Title Matching and Filtering

To prevent irrelevant products (e.g., a search for "Nike shoes" returning a Nike water bottle), a token-based title matching algorithm is applied:

```javascript
titleMatchesTokens(titleNorm, queryTokens) {
  // Electronics: ALL tokens must match
  return queryTokens.every(token => titleNorm.includes(token));

  // Grocery/Fashion: at least HALF the tokens must match
  const matched = queryTokens.filter(t => titleNorm.includes(t));
  return matched.length >= Math.ceil(queryTokens.length / 2);
}
```

Alphanumeric tokens (e.g., model numbers like `"15r"`) are also matched against the title with spaces removed to handle formats like `"15 R"`.

### 8.3 Offer Parsing (Amazon and Flipkart)

The offer extraction pipeline processes the product page's `innerText` line by line:

```
Parsing strategy for "Bank Offers" section:
  1. Detect "bank offers" heading line
  2. Scan subsequent lines (up to 60) for ₹X off amounts
  3. Identify payment type from surrounding lines (credit/debit/UPI)
  4. Keep only the BEST offer per payment type (deduplication)
  5. Stop at section boundaries (delivery, highlights, specifications)

Coupon extraction:
  1. Detect "coupons" heading
  2. Read next line for "₹X off" amount
  3. Keep only the first (best) coupon
```

---

## 9. Performance Characteristics

### 9.1 Scraper Performance (Cold Search, Observed)

| Platform | Avg Scrape Time | Products Returned | Notes |
|---|---|---|---|
| Amazon (electronics) | 90–110 s | 20 | Includes 20 product page visits |
| Amazon Fresh (grocery) | 90–110 s | 20 | Same offer extraction path |
| Flipkart | 15–25 s | 20 | Includes 15 product page visits |
| Flipkart Minutes | 20–35 s | 15–20 | Includes location setup |
| Croma | 1–2 s | 10–20 | Pure API, no browser |
| Reliance Digital | 1–2 s | 10–20 | Pure API, no browser |
| Myntra | 8–15 s | 20 | DOM with scrolling |
| Ajio | 1–3 s | 20–45 | Pure API, no browser |
| Tata CLiQ | 1–2 s | 20–40 | Pure API, no browser |
| Zepto | 1.5–3 s | 8–20 | BFF API intercept |
| Swiggy Instamart | 20–30 s | 0–10 | Variable (WAF issues) |

### 9.2 End-to-End Response Times

- **Cache hit**: < 100ms
- **Cold search (grocery, 4 platforms)**: 95–115 seconds (bottlenecked by Amazon Fresh)
- **Cold search (electronics, 4 platforms)**: 90–115 seconds
- **Cold search (fashion, 5 platforms)**: 15–25 seconds (no offer extraction on fashion)

### 9.3 Concurrent Execution

Scrapers run in parallel within each chunk. The concurrency limit (configurable) controls how many platforms scrape simultaneously. For grocery with 4 platforms, all run concurrently. Total wall-clock time equals the slowest scraper (Amazon at ~105s).

### 9.4 Resource Utilization

- **Memory**: ~300–600 MB (Chromium browser + Node.js)
- **CPU**: Spikes during page rendering (Playwright), idle between searches
- **Network**: ~50–200 HTTP requests per search query (varies by offer extraction)

---

## 10. Challenges Faced and Solutions

### 10.1 Dynamic JavaScript SPAs

**Problem**: Raw `fetch()` to Myntra, Zepto, Ajio returns empty HTML since product data is rendered client-side.

**Solution**: Playwright renders the full page in a real Chromium browser, executing JavaScript and capturing the populated DOM.

### 10.2 Hashed CSS Class Names (Ajio, Tata CLiQ)

**Problem**: React apps compiled with CSS modules use hashed class names (e.g., `.sc-bQCEYZ`) that change with every deployment, breaking CSS selector-based scrapers.

**Solution**: Switch to direct JSON API calls that bypass the rendering layer entirely. Both Ajio and Tata CLiQ expose unauthenticated search APIs.

### 10.3 Zepto Headless Detection

**Problem**: Zepto detects HeadlessChrome via the absence of `sec-ch-ua` client hint headers and returns a near-empty DOM.

**Solution**: Inject authentic `sec-ch-ua` headers in the Playwright browser context configuration, making Zepto treat the request as originating from Chrome 120.

### 10.4 Zepto BFF API Structure

**Problem**: Zepto's product grid data is nested 7 levels deep in a layout widget array, and prices are in paise (not rupees).

**Solution**: Traverse `layout → find PRODUCT_GRID widget → data.resolver.data.items → productResponse`, divide prices by 100.

### 10.5 Flipkart Minutes GPS Geolocation

**Problem**: Flipkart's "Current Location" GPS button triggers `navigator.geolocation.getCurrentPosition()`, but the callback never fires in headless Playwright (confirmed via DOM debug logging showing indefinitely stuck "detecting location" state).

**Solution**: Bypass Flipkart's GPS UI entirely. Use Nominatim's reverse geocoding API (`/reverse?lat=&lon=`) on the backend to resolve GPS coordinates to a 6-digit Indian pincode, then directly enter the pincode into Flipkart's standard pincode input field.

### 10.6 Swiggy Instamart AWS WAF

**Problem**: Swiggy Instamart's search endpoint (`/instamart/search`) is protected by AWS WAF which issues a session token challenge, blocking automated navigation.

**Current Status**: Home page and location setup succeed; search page returns empty results. A DevTools-captured search API endpoint would be required to bypass this.

### 10.7 Amazon Offer Extraction Speed

**Problem**: Visiting 20 product pages sequentially takes 90+ seconds, making Amazon the system's bottleneck.

**Mitigation**: 3 concurrent product page visits within the same browser context (`concurrentPageVisits = 3`), reducing the visit count from ~90s sequential to ~30s concurrent (3× speedup for offer extraction phase).

### 10.8 Myntra 401/404 API Responses

**Problem**: Myntra's gateway API returns 401 (unauthorized) for unauthenticated requests, and direct search API calls return 404.

**Solution**: Playwright DOM scraping with the real browser session. Myntra serves server-rendered product listing HTML accessible with standard browser headers.

---

## 11. Key Design Decisions

### 11.1 Inheritance Hierarchy for Related Platforms

Amazon Fresh, Amazon Fashion, and the three Amazon variants all share core scraping logic via inheritance from a single `AmazonScraper` base class. Subclasses only override `buildSearchUrl()`, `filterAccessories()`, `titleMatchesTokens()`, and `scrape()` (for delivery time injection). This prevents code duplication across ~40% of platform scrapers.

### 11.2 Graceful Degradation

The system is designed to return partial results when individual scrapers fail. An error in one scraper does not abort the others. The orchestrator collects results from all successful scrapers, and the frontend displays whatever is available with per-platform success indicators.

### 11.3 Optional Infrastructure

Redis (caching) and PostgreSQL/SQLite (search history) are optional. The system starts and runs fully without them, logging warnings. This simplifies development and allows deployment to environments without these services.

### 11.4 API Interception Over DOM Parsing

Where a direct API call can be discovered (via DevTools → Network tab), it is always preferred over DOM scraping. API responses are structured, stable, faster to process, and unaffected by CSS class name changes. This principle drove the rewrites of Croma, Reliance Digital, Ajio, Tata CLiQ (direct API), and Zepto (passive BFF interception).

---

## 12. Results and Evaluation

### 12.1 Platform Coverage

Of 12 targeted platform variants, **11 return products reliably**:
- Swiggy Instamart is partially functional (home/location setup works; search blocked by AWS WAF)

### 12.2 Sample Search Results

**Query: "buttermilk" (Category: Grocery, GPS: Bengaluru)**

| Platform | Products | Delivery Time |
|---|---|---|
| Amazon Fresh | 20 | Same day |
| Flipkart Minutes | Variable | ~15 mins |
| Zepto | 8 | ~10 mins |
| Swiggy Instamart | 0 (WAF) | — |

**Query: "Nike shoes" (Category: Fashion)**

| Platform | Products | Notes |
|---|---|---|
| Amazon Fashion | 20 | With offers |
| Flipkart Fashion | 20 | With offers |
| Myntra | 20 | With ratings |
| Ajio | 20–45 | Without ratings |
| Tata CLiQ | 20–40 | With ratings |

**Query: "iPhone" (Category: Electronics)**

| Platform | Products | Offers |
|---|---|---|
| Amazon | 20 | Bank, cashback, EMI |
| Flipkart | 20 | Bank, coupon |
| Croma | 10–20 | None (listing only) |
| Reliance Digital | 10–20 | None (listing only) |

### 12.3 Offer Extraction Accuracy

Amazon and Flipkart offer extraction captures:
- Up to 3 bank offers (best per payment type)
- Up to 1 coupon per product
- No-cost EMI availability
- Exchange offers

Fashion platforms (Myntra, Ajio, Tata CLiQ) do not have Amazon/Flipkart-style bank offer programs; the discount is built into the listed price. No offer extraction is attempted for these platforms (correct behavior).

---

## 13. Future Work

### 13.1 Additional Platforms
- **Nykaa Fashion**: Fashion and beauty vertical
- **Meesho**: Unorganized/SMB fashion marketplace
- **JioMart**: Reliance's grocery platform
- **Blinkit (Zomato)**: Quick-commerce grocery
- **BigBasket**: Scheduled grocery delivery

### 13.2 Swiggy Instamart WAF Bypass
Using the network-intercepted search API (captured via DevTools) with session token management to bypass the AWS WAF challenge.

### 13.3 Price History Tracking
Storing daily price snapshots in the database to enable price trend charts and price-drop alerts.

### 13.4 Offer-Aware Effective Price Computation
Automatically computing the effective price after applying the best bank offer (e.g., 10% HDFC cashback → effective price = listed price × 0.9), enabling true apples-to-apples comparison.

### 13.5 Machine Learning-Based Product Matching
Cross-platform product deduplication using sentence embeddings (e.g., SBERT) to identify the same physical product listed across multiple platforms, enabling a single unified product view with all platform prices.

### 13.6 Distributed Scraping
Replacing the single-node Playwright pool with a distributed browser farm (e.g., using Playwright's remote browser support or a dedicated scraping infrastructure like Browserless) to increase throughput and enable geographic distribution.

---

## 14. System Limitations

| Limitation | Description |
|---|---|
| Amazon scrape speed | Product page visits make Amazon the bottleneck (~105s cold) |
| Swiggy Instamart | AWS WAF blocks search page; 0 products |
| Myntra API block | 401 on direct API; Playwright DOM works but slower |
| Zepto GPS | Does not navigate away from injected location; results may be city-default |
| Platform changes | CSS selectors and API endpoints can change on platform redesigns |
| No price history | Each search returns current prices only |
| Offers on fashion | Fashion platforms don't expose bank offers; discount is listed price |
| Single server | All scrapers share one Chromium instance; not horizontally scaled |

---

## 15. Technology Summary

| Concern | Solution | Rationale |
|---|---|---|
| SPA rendering | Playwright (Chromium) | Full JS execution, Playwright API |
| API discovery | DevTools Network tab | Most reliable for structured data |
| Bot detection bypass | `sec-ch-ua` injection, userAgent, scrolling | Mimics real Chrome behaviour |
| Geolocation | `context.setGeolocation()` | Native Playwright API |
| GPS → Pincode | Nominatim (OpenStreetMap) | Free, no API key, global coverage |
| Concurrency | `Promise.all()` per chunk | Simple, effective, Node.js native |
| Schema normalization | `BaseScraper.createProduct()` | Single source of truth |
| Error isolation | Per-scraper try/catch | Partial results over total failure |
| Caching | Redis (optional) | 15-min TTL, location-keyed |
| Logging | Winston JSON | Structured, queryable logs |
| Frontend | React 18 + Vite | Fast HMR, modern tooling |
| Reverse geocoding | Nominatim API | Frontend (city name) + Backend (pincode) |

---

## 16. Conclusion

This paper presented a real-time multi-platform e-commerce price aggregation system targeting the Indian market. The system successfully aggregates live product data from eleven of twelve targeted platforms across electronics, fashion, and grocery categories using a hybrid strategy of direct API calls, passive API response interception, and Playwright-based browser automation. Key innovations include the `sec-ch-ua` client hint injection for Zepto's headless detection bypass, passive BFF API interception for Zepto's 7-level-deep response structure, GPS-to-pincode backend resolution via Nominatim for Flipkart Minutes, and a unified product schema that normalizes eleven different source formats. The location-aware grocery pipeline enables hyperlocal delivery time comparison across Zepto (~10 min), Swiggy Instamart (~15 min), Flipkart Minutes (~15 min), and Amazon Fresh (same day). The system demonstrates that a systematic approach combining API discovery, browser fingerprint normalization, and graceful degradation can produce a reliable, production-ready price comparison tool for fragmented e-commerce ecosystems.

---

## References

1. Vastel, A., Laperdrix, P., Rudametkin, W., & Rouvoy, R. (2018). FP-STALKER: Tracking Browser Fingerprint Evolutions. *IEEE S&P 2018*.
2. Laperdrix, P., Bielova, N., Baudry, B., & Avoine, G. (2020). Browser Fingerprinting: A Survey. *ACM Transactions on the Web*.
3. Snoeck, A., Winkenbach, M., & Toriello, A. (2022). Optimal Dark Store Location and Fleet Management for Ultra-fast Delivery. *MIT CTL Research Paper*.
4. Playwright Documentation. (2024). Microsoft. https://playwright.dev/docs
5. Nominatim Usage Policy. (2024). OpenStreetMap Foundation. https://operations.osmfoundation.org/policies/nominatim
6. Fazzini, M., et al. (2019). Automated Extraction of Instant App. *ICSE 2019*.
7. India Brand Equity Foundation. (2024). E-commerce Industry Report. https://www.ibef.org/industry/ecommerce

---

*Document version: 1.0 — Generated for IEEE conference/journal submission preparation*
*System: Real-Time Multi-Platform E-Commerce Price Aggregation System*
*Platforms: 12 | Categories: 3 | Scraping strategies: 4*
