# Multi-Platform E-Commerce Price Comparison System

Production-grade price comparison system using API interception for stable, maintainable scraping.

## Architecture Overview

```
Frontend (React) → Express API → Scraper Orchestrator → Platform Scrapers → Playwright
                                      ↓
                              Redis Cache + PostgreSQL
```

## Tech Stack

- **Backend**: Node.js 18+, Express, Playwright
- **Frontend**: React 18, Vite
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+

## Features

- ✅ API-interception-first scraping (stable, less fragile)
- ✅ Modular platform scrapers (easy to add/remove)
- ✅ Graceful failure handling (partial results on platform failure)
- ✅ Redis caching (15-min TTL, prevents duplicate scraping)
- ✅ Controlled concurrency (prevents overwhelming servers)
- ✅ Exponential backoff retry
- ✅ Structured logging (Winston)
- ✅ Price calculation engine
- ✅ Product matching across platforms
- ✅ PostgreSQL history tracking

## Supported Platforms

### Electronics
- Amazon India ✅
- Flipkart ✅
- Croma ⚠️ (Disabled - Bot detection blocks automated access)

### Fashion
- Myntra ⚠️ (Disabled - HTTP2 protocol error, bot detection)

**Note**: Croma and Myntra have strong bot detection that blocks automated browsers. See `CROMA_LIMITATION.md` for details.

**Adding more platforms**: Create new scraper in `backend/src/scrapers/platforms/` extending `BaseScraper`.

## Setup Instructions

### Prerequisites

```bash
# Install Node.js 18+
node --version

# Install PostgreSQL 14+
psql --version

# Install Redis 7+
redis-cli --version
```

### 1. Database Setup

```bash
# Create database
psql -U postgres
CREATE DATABASE price_comparison;
\q

# Run schema
psql -U postgres -d price_comparison -f backend/src/models/schema.sql
```

### 2. Redis Setup

```bash
# Start Redis server
redis-server

# Verify
redis-cli ping
# Should return: PONG
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Start server
npm run dev
```

Backend runs on: http://localhost:3000

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs on: http://localhost:5173

## API Endpoints

### Search Products

```
GET /api/search?q=<query>
```

**Response:**
```json
{
  "query": "iphone 15",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "totalProducts": 15,
  "platforms": {
    "Amazon": { "success": true, "count": 5 },
    "Flipkart": { "success": true, "count": 5 },
    "Croma": { "success": true, "count": 5 }
  },
  "products": [...],
  "bestDeals": {
    "lowestBasePrice": {...},
    "lowestEffectivePrice": {...}
  },
  "cached": false,
  "responseTime": 12453
}
```

### Health Check

```
GET /health
```

## How It Works

### 1. API Interception Strategy

**Why API interception?**
- DOM selectors break with UI changes
- Internal APIs are versioned and stable
- JSON parsing is faster and more reliable
- Less bandwidth (no images/CSS)

**Implementation:**
```javascript
page.on('response', async (response) => {
  if (response.url().includes('/api/search')) {
    const data = await response.json();
    // Parse structured data
  }
});
```

**Fallback:** If API interception fails, scrapers fall back to DOM parsing.

### 2. Scraper Architecture

Each platform scraper:
1. Extends `BaseScraper` abstract class
2. Implements `scrape(query, page)` method
3. Returns standardized product schema
4. Handles errors gracefully (returns empty array)

**Adding new platform:**
```javascript
// backend/src/scrapers/platforms/myntra.js
import BaseScraper from '../base.js';

export default class MyntraScraper extends BaseScraper {
  constructor() {
    super('Myntra');
    this.baseUrl = 'https://www.myntra.com';
  }

  async scrape(query, page) {
    // Implement scraping logic
    return products;
  }
}
```

Then register in `orchestrator.js`:
```javascript
import MyntraScraper from './platforms/myntra.js';

this.scrapers = [
  new AmazonScraper(),
  new FlipkartScraper(),
  new CromaScraper(),
  new MyntraScraper() // Add here
];
```

### 3. Failure Handling

**Platform timeout:** Returns partial results from successful platforms
**API change:** Logs error, falls back to DOM if implemented
**Rate limiting:** Exponential backoff, max 3 retries
**Network error:** Retry with jitter

### 4. Caching Strategy

- Cache key: `search:{normalized_query}`
- TTL: 15 minutes (configurable)
- Prevents duplicate scraping for same query
- Reduces load on target platforms

### 5. Price Calculation

```javascript
effectivePrice = basePrice 
  - couponDiscount (if deterministic)
  - bankOffer (if deterministic)
  + shippingCost
```

**Non-deterministic offers** (e.g., "Up to 10% off") are stored separately but NOT included in effective price.

## Debugging API Interception

### Finding Internal APIs

1. **Open DevTools Network Tab**
   - Visit target website
   - Search for a product
   - Filter by XHR/Fetch
   - Look for JSON responses

2. **Identify API Patterns**
   - Amazon: `/s/query`, `search-alias`
   - Flipkart: `/api/3/page/fetch`
   - Look for responses with product data

3. **Capture in Playwright**
   ```javascript
   page.on('response', async (response) => {
     console.log(response.url());
     if (response.url().includes('YOUR_API_PATTERN')) {
       const data = await response.json();
       console.log(data);
     }
   });
   ```

4. **Parse Response Structure**
   - Identify product array location
   - Map fields to standardized schema

### Common Issues

**API not captured:**
- Wait longer: `await page.waitForTimeout(2000)`
- Check URL pattern is correct
- Verify response is JSON (not HTML)

**Parsing fails:**
- Log raw response: `console.log(await response.text())`
- Check field names in actual response
- Handle missing fields gracefully

**Rate limited:**
- Increase retry delay
- Add random jitter
- Reduce concurrent requests

## Monitoring

### Logs

```bash
# View all logs
tail -f backend/logs/combined.log

# View errors only
tail -f backend/logs/error.log
```

### Database Queries

```sql
-- Recent searches
SELECT * FROM searches ORDER BY timestamp DESC LIMIT 10;

-- Platform health
SELECT platform, status, COUNT(*) 
FROM platform_health 
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY platform, status;

-- Price trends
SELECT source, AVG(base_price) as avg_price
FROM product_snapshots
WHERE title ILIKE '%iphone%'
GROUP BY source;
```

## Scaling Strategy

### Current: Single Server

- User-triggered scraping only
- Controlled concurrency (3 platforms max)
- Redis caching reduces load
- Suitable for 100-1000 searches/day

### Scale to 10K searches/day

1. **Horizontal scaling**: Deploy multiple backend instances behind load balancer
2. **Shared Redis**: All instances use same Redis cluster
3. **Shared PostgreSQL**: Connection pooling
4. **Browser pool per instance**: Each instance manages own Playwright browsers

### Scale to 100K+ searches/day

1. **Queue-based architecture**: RabbitMQ/SQS for scraping jobs
2. **Dedicated scraper workers**: Separate from API servers
3. **Distributed caching**: Redis Cluster
4. **Database sharding**: Partition by date
5. **CDN**: Cache static frontend assets

## Maintenance

### Weekly Tasks

- Review error logs for new patterns
- Check platform health metrics
- Update selectors if DOM fallback fails

### Monthly Tasks

- Update Playwright browsers: `npx playwright install chromium`
- Review and optimize database indexes
- Clean old logs: `find backend/logs -mtime +30 -delete`

### When Platform Changes

1. Check error logs for specific platform
2. Visit platform manually, inspect Network tab
3. Update API pattern or DOM selectors
4. Test with `npm run dev`
5. Deploy update

## Legal & Ethical Considerations

- **Respect robots.txt**: Check platform policies
- **Rate limiting**: Don't overwhelm servers
- **User-triggered only**: No automated crawling
- **No data resale**: Personal use only
- **Terms of Service**: Review each platform's ToS

## License

MIT

## Support

For issues or questions, check logs first:
```bash
tail -f backend/logs/error.log
```
