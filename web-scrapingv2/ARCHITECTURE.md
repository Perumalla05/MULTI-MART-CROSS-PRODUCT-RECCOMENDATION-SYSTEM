# System Architecture Diagram

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                               │
│                     http://localhost:5173                            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ HTTP Request
                                 │ GET /api/search?q=iPhone
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        REACT FRONTEND (Vite)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  SearchBar   │  │ ResultsGrid  │  │ ProductCard  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  Services:                                                           │
│  └─ api.js (fetch wrapper)                                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ Proxy to Backend
                                 │ (Vite dev server)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS API SERVER (Node.js)                      │
│                        http://localhost:3000                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │  MIDDLEWARE LAYER                                      │         │
│  │  ├─ CORS                                               │         │
│  │  ├─ Request Validator (validateSearchQuery)            │         │
│  │  └─ Error Handler (global error catching)             │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │  ROUTES                                                │         │
│  │  ├─ GET /health                                        │         │
│  │  └─ GET /api/search?q=<query>                         │         │
│  └────────────────────────────────────────────────────────┘         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
         ┌──────────────┐ ┌──────────┐ ┌──────────────┐
         │ Redis Cache  │ │ Scraper  │ │  PostgreSQL  │
         │   Service    │ │Orchestr. │ │   Service    │
         └──────────────┘ └──────────┘ └──────────────┘
                │              │              │
                │              │              │
         Cache Hit?      Parallel       Log Search
         Return cached   Execution      History
                │              │              │
                │              ▼              │
                │    ┌─────────────────┐     │
                │    │ Browser Pool    │     │
                │    │ (Playwright)    │     │
                │    └─────────────────┘     │
                │              │              │
                │              ▼              │
                │    ┌─────────────────┐     │
                │    │ Platform        │     │
                │    │ Scrapers        │     │
                │    │ (Concurrent)    │     │
                │    └─────────────────┘     │
                │              │              │
                │    ┌─────────┼─────────┐   │
                │    │         │         │   │
                │    ▼         ▼         ▼   │
                │  ┌────┐  ┌────┐  ┌────┐   │
                │  │AMZ │  │FLP │  │CRM │   │
                │  └────┘  └────┘  └────┘   │
                │    │         │         │   │
                │    └─────────┼─────────┘   │
                │              │              │
                │              ▼              │
                │    ┌─────────────────┐     │
                │    │ Data Processing │     │
                │    │ ├─ Price Engine │     │
                │    │ ├─ Product Match│     │
                │    │ └─ Aggregation  │     │
                │    └─────────────────┘     │
                │              │              │
                └──────────────┼──────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  JSON Response   │
                    │  to Frontend     │
                    └──────────────────┘
```

## Component Breakdown

### 1. Frontend Layer (React + Vite)

```
frontend/
├── SearchBar.jsx       → User input component
├── ResultsGrid.jsx     → Display aggregated results
├── ProductCard.jsx     → Individual product display
├── api.js              → Backend communication
└── format.js           → Price/discount formatting
```

**Responsibilities:**
- User interface
- Search input handling
- Results visualization
- Price comparison display
- Error/loading states

### 2. API Layer (Express)

```
backend/src/
├── server.js           → Express app initialization
├── routes/
│   └── search.js       → Search endpoint logic
└── middleware/
    ├── validator.js    → Input validation
    └── errorHandler.js → Global error handling
```

**Responsibilities:**
- Request validation
- Route handling
- Response formatting
- Error handling
- CORS management

### 3. Caching Layer (Redis)

```
backend/src/services/
└── cache.js            → Redis client wrapper
```

**Responsibilities:**
- Cache search results (15-min TTL)
- Reduce redundant scraping
- Improve response time
- Key normalization

**Cache Flow:**
```
Request → Check Cache → Hit? → Return cached
                     → Miss? → Scrape → Cache → Return
```

### 4. Scraping Layer

```
backend/src/scrapers/
├── orchestrator.js     → Parallel execution controller
├── base.js             → Abstract scraper class
└── platforms/
    ├── amazon.js       → Amazon India scraper
    ├── flipkart.js     → Flipkart scraper
    └── croma.js        → Croma scraper
```

**Orchestrator Flow:**
```
Query → Split into chunks (concurrency limit)
     → Execute scrapers in parallel
     → Collect results (even if some fail)
     → Aggregate all products
     → Return combined results
```

**Individual Scraper Flow:**
```
1. Get browser context from pool
2. Navigate to search URL
3. Intercept API responses (primary)
4. Parse JSON data
5. If API fails → DOM scraping (fallback)
6. Normalize to standard schema
7. Return products array
8. Close page
```

### 5. Browser Pool (Playwright)

```
backend/src/services/
└── browserPool.js      → Browser lifecycle management
```

**Responsibilities:**
- Launch Chromium browser
- Create contexts per platform
- Reuse contexts (performance)
- Clean shutdown

**Context Configuration:**
```javascript
{
  userAgent: 'Chrome/120.0.0.0',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata'
}
```

### 6. Data Processing Layer

```
backend/src/services/
├── priceEngine.js      → Price calculations
└── productMatcher.js   → Cross-platform matching
```

**Price Engine:**
```
effectivePrice = basePrice 
               - couponDiscount (if deterministic)
               - bankOffer (if deterministic)
               + shippingCost
```

**Product Matcher:**
```
1. Normalize titles (lowercase, remove punctuation)
2. Extract tokens
3. Calculate Jaccard similarity
4. Group products with similarity > 0.4
5. Sort by platform count
```

### 7. Storage Layer

```
backend/src/
├── services/
│   └── database.js     → PostgreSQL client
└── models/
    └── schema.sql      → Database schema
```

**Tables:**
- `searches` → Search history
- `product_snapshots` → Product prices over time
- `platform_health` → Platform availability tracking

### 8. Utilities

```
backend/src/utils/
├── logger.js           → Winston structured logging
└── retry.js            → Exponential backoff retry
```

**Logger Output:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Scrape completed",
  "platform": "Amazon",
  "query": "iPhone 15",
  "results": 5,
  "duration": 3421
}
```

## Data Flow Example

### User searches for "iPhone 15"

```
1. User types "iPhone 15" → Clicks Search
   └─ SearchBar.jsx → onSearch("iPhone 15")

2. Frontend calls API
   └─ api.js → fetch('/api/search?q=iPhone 15')

3. Express receives request
   └─ validator.js → Validates query
   └─ search.js → Handles request

4. Check Redis cache
   └─ cache.js → get("search:iphone_15")
   └─ Cache miss → Continue

5. Trigger scraping
   └─ orchestrator.js → scrapeAll("iPhone 15")

6. Parallel execution (3 platforms)
   ├─ Amazon scraper
   │  ├─ Navigate to amazon.in/s?k=iPhone+15
   │  ├─ Intercept API response
   │  ├─ Parse JSON → 5 products
   │  └─ Return standardized products
   │
   ├─ Flipkart scraper
   │  ├─ Navigate to flipkart.com/search?q=iPhone+15
   │  ├─ Intercept API response
   │  ├─ Parse JSON → 5 products
   │  └─ Return standardized products
   │
   └─ Croma scraper
      ├─ Navigate to croma.com/search?q=iPhone+15
      ├─ DOM scraping (no API)
      ├─ Parse HTML → 5 products
      └─ Return standardized products

7. Aggregate results
   └─ orchestrator.js → Combine all products (15 total)

8. Process data
   ├─ priceEngine.js → Calculate effective prices
   ├─ productMatcher.js → Group similar products
   └─ Find best deals

9. Cache results
   └─ cache.js → set("search:iphone_15", results, 900s)

10. Log to database (async)
    └─ database.js → Insert search + products

11. Return response
    └─ Express → JSON response to frontend

12. Frontend displays
    ├─ ResultsGrid.jsx → Render 15 products
    ├─ ProductCard.jsx → Show each product
    └─ Highlight best deal
```

## Error Handling Flow

```
Error occurs in scraper
    │
    ├─ Timeout? → Log timeout → Return []
    ├─ Network error? → Retry (3x) → Return []
    ├─ Parsing error? → Log error → Return []
    └─ Unknown error? → Log stack → Return []
    
Orchestrator receives results
    │
    ├─ Some platforms succeeded? → Return partial results
    └─ All platforms failed? → Return empty with errors
    
Frontend receives response
    │
    ├─ Has products? → Display results
    ├─ Has errors? → Show warning
    └─ Empty? → Show "No results found"
```

## Scaling Architecture

### Current (Single Server)
```
┌─────────────────────────────────┐
│  Single Server                  │
│  ├─ Node.js (Express)           │
│  ├─ PostgreSQL                  │
│  ├─ Redis                       │
│  └─ Playwright Browsers         │
└─────────────────────────────────┘
```

### Scaled (Multiple Servers)
```
┌──────────────┐
│ Load Balancer│
└──────┬───────┘
       │
   ┌───┴───┬───────┬───────┐
   │       │       │       │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│API 1│ │API 2│ │API 3│ │API 4│
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │       │       │       │
   └───┬───┴───┬───┴───┬───┘
       │       │       │
   ┌───▼───────▼───────▼───┐
   │   Redis Cluster        │
   └────────────────────────┘
       │
   ┌───▼────────────────────┐
   │   PostgreSQL Primary   │
   │   (with replicas)      │
   └────────────────────────┘
```

## Technology Choices Explained

| Component | Technology | Why? |
|-----------|-----------|------|
| Frontend | React | Component-based, fast, familiar |
| Build Tool | Vite | Fast HMR, modern, simple config |
| Backend | Express | Minimal, flexible, well-documented |
| Browser | Playwright | Modern, reliable, good API |
| Database | PostgreSQL | Robust, ACID, good for analytics |
| Cache | Redis | Fast, simple, perfect for caching |
| Logging | Winston | Structured, flexible, production-ready |

## Performance Characteristics

### Response Times (Typical)
- Cache hit: 50-100ms
- Cache miss (3 platforms): 5-15 seconds
- Single platform: 2-5 seconds

### Resource Usage
- Memory: ~200-500MB (with browser)
- CPU: Spikes during scraping, idle otherwise
- Disk: Minimal (logs + database)

### Throughput
- Single server: 100-1000 searches/day
- With caching: 10x improvement
- Scaled: 10,000+ searches/day

## Security Layers

```
1. Input Validation
   └─ Sanitize query, length limits

2. Rate Limiting (not implemented, easy to add)
   └─ Limit requests per IP

3. CORS
   └─ Restrict origins in production

4. Environment Variables
   └─ Secrets not in code

5. Database
   └─ Parameterized queries (SQL injection safe)

6. Error Handling
   └─ Don't expose stack traces in production
```

## Monitoring Points

```
1. Application Logs
   └─ backend/logs/*.log

2. Database Metrics
   └─ Query performance, connection count

3. Redis Metrics
   └─ Hit rate, memory usage

4. Platform Health
   └─ Success/failure rates per platform

5. Response Times
   └─ API endpoint latency

6. Error Rates
   └─ Failed scrapes, timeouts
```

---

**This architecture is:**
- ✅ Modular (easy to modify)
- ✅ Scalable (can grow with demand)
- ✅ Resilient (handles failures gracefully)
- ✅ Maintainable (clear structure)
- ✅ Observable (comprehensive logging)
- ✅ Production-ready (error handling, caching, monitoring)
