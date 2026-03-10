# Quick Start Guide

## Prerequisites Check

```bash
# Check Node.js (need 18+)
node --version

# Check PostgreSQL (need 14+)
psql --version

# Check Redis (need 7+)
redis-cli --version
```

## 5-Minute Setup

### 1. Start Services

```bash
# Terminal 1: Start PostgreSQL (if not running)
# Windows: Start from Services or pgAdmin
# Linux/Mac: sudo service postgresql start

# Terminal 2: Start Redis
redis-server

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### 2. Setup Database

```bash
# Create database
psql -U postgres
CREATE DATABASE price_comparison;
\q

# Run schema
cd backend
psql -U postgres -d price_comparison -f src/models/schema.sql
```

### 3. Install & Run Backend

```bash
cd backend

# Install dependencies
npm install

# Install Playwright browsers (one-time, ~300MB)
npx playwright install chromium

# Update .env if needed (default password is 'postgres')
# Edit backend/.env

# Start backend
npm run dev
```

Backend should start on http://localhost:3000

### 4. Install & Run Frontend

```bash
# New terminal
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

Frontend should start on http://localhost:5173

### 5. Test

Open browser: http://localhost:5173

Search for: "iPhone 15" or "Samsung TV"

## Troubleshooting

### Backend won't start

**Error: "Cannot connect to database"**
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Check credentials in backend/.env
# Default: DB_USER=postgres, DB_PASSWORD=postgres
```

**Error: "Cannot connect to Redis"**
```bash
# Check Redis is running
redis-cli ping

# If not running, start it:
redis-server
```

**Error: "Playwright browsers not found"**
```bash
cd backend
npx playwright install chromium
```

### Frontend won't start

**Error: "Cannot GET /api/search"**
- Make sure backend is running on port 3000
- Check backend terminal for errors

### Scraping returns empty results

**Check logs:**
```bash
tail -f backend/logs/combined.log
```

**Common causes:**
- Platform changed their website structure
- Network timeout (increase SCRAPER_TIMEOUT in .env)
- Rate limited (wait a few minutes)

### Platform-specific issues

**Amazon returns no results:**
- Check if you can access amazon.in manually
- May need to update selectors in `backend/src/scrapers/platforms/amazon.js`

**Flipkart returns no results:**
- API pattern may have changed
- Check Network tab in browser DevTools for new API endpoints

## Testing Individual Scrapers

```bash
cd backend

# Create test file
cat > test-scraper.js << 'EOF'
import AmazonScraper from './src/scrapers/platforms/amazon.js';
import browserPool from './src/services/browserPool.js';

async function test() {
  await browserPool.initialize();
  const scraper = new AmazonScraper();
  const context = await browserPool.getContext('Amazon');
  const results = await scraper.execute('iPhone 15', context);
  console.log(JSON.stringify(results, null, 2));
  await browserPool.shutdown();
}

test();
EOF

# Run test
node test-scraper.js
```

## Next Steps

1. **Add more platforms**: Copy template from `backend/src/scrapers/platforms/` and customize
2. **Adjust cache TTL**: Edit `REDIS_CACHE_TTL` in `.env` (default 900 seconds = 15 minutes)
3. **Increase results**: Edit `SCRAPER_RESULTS_PER_PLATFORM` in `.env` (default 5)
4. **Monitor logs**: `tail -f backend/logs/combined.log`

## Production Deployment

See README.md "Scaling Strategy" section for production deployment guide.

## Need Help?

1. Check logs: `tail -f backend/logs/error.log`
2. Enable debug logging: Set `LOG_LEVEL=debug` in `.env`
3. Test individual components using test scripts above
