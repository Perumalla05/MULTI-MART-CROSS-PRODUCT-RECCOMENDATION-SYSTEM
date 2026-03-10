# Maintenance Guide

## Overview

This system is designed for minimal maintenance, but e-commerce platforms do change their websites. This guide helps you maintain the system long-term.

## Monitoring Health

### Daily Checks (Automated)

Set up a cron job or scheduled task:

```bash
# Check if services are running
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-15T10:30:00.000Z"}
```

### Weekly Manual Checks

1. **Test Each Platform**
   ```bash
   cd backend
   node test-scraper.js amazon "iPhone 15"
   node test-scraper.js flipkart "Samsung TV"
   node test-scraper.js croma "Sony headphones"
   ```

2. **Review Error Logs**
   ```bash
   # Check for patterns
   tail -100 backend/logs/error.log | grep "Scrape failed"
   
   # Count failures by platform
   grep "Scrape failed" backend/logs/error.log | grep -o "platform.*" | sort | uniq -c
   ```

3. **Check Cache Hit Rate**
   ```bash
   # In Redis CLI
   redis-cli
   INFO stats
   # Look for keyspace_hits vs keyspace_misses
   ```

4. **Database Health**
   ```sql
   -- Recent search success rate
   SELECT 
     COUNT(*) as total_searches,
     AVG(successful_platforms) as avg_success,
     AVG(duration_ms) as avg_duration
   FROM searches
   WHERE timestamp > NOW() - INTERVAL '7 days';
   
   -- Platform failure rate
   SELECT 
     platform,
     status,
     COUNT(*) as count
   FROM platform_health
   WHERE timestamp > NOW() - INTERVAL '7 days'
   GROUP BY platform, status
   ORDER BY platform, status;
   ```

## Common Maintenance Tasks

### Task 1: Platform Stopped Working

**Symptoms:**
- Scraper returns 0 products
- Logs show "No products found"
- Previously working platform now fails

**Diagnosis:**

1. **Test Manually**
   ```bash
   node test-scraper.js <platform> "test query"
   ```

2. **Check if Website Changed**
   - Visit platform website manually
   - Search for a product
   - Open DevTools → Network tab
   - Look for API calls

3. **Debug API Interception**
   ```bash
   node debug-api.js <platform>
   ```

**Fix:**

**Option A: API Pattern Changed**

```javascript
// Before
if (url.includes('/api/search'))

// After (if they added version)
if (url.includes('/api/v2/search'))
```

**Option B: Response Structure Changed**

```javascript
// Before
const products = data.products;

// After
const products = data.results.items;
```

**Option C: Selectors Changed (DOM fallback)**

1. Inspect element on website
2. Find new selectors
3. Update scraper:

```javascript
// Before
const items = await page.$$('.product-item');

// After (if class changed)
const items = await page.$$('.product-card');
```

### Task 2: Rate Limited

**Symptoms:**
- First few searches work, then fail
- 429 status codes in logs
- "Access Denied" pages

**Fix:**

1. **Reduce Concurrency**
   ```env
   # .env
   SCRAPER_CONCURRENT_LIMIT=1  # Was 3
   ```

2. **Increase Delays**
   ```javascript
   // In scraper
   await page.waitForTimeout(3000); // Was 2000
   ```

3. **Add Random Jitter**
   ```javascript
   const delay = 2000 + Math.random() * 2000;
   await page.waitForTimeout(delay);
   ```

### Task 3: Slow Performance

**Symptoms:**
- Searches take >30 seconds
- Timeout errors
- High CPU usage

**Diagnosis:**

```bash
# Check response times
grep "responseTime" backend/logs/combined.log | tail -20

# Check platform-specific duration
grep "Scrape completed" backend/logs/combined.log | grep "Amazon"
```

**Fix:**

1. **Increase Timeout**
   ```env
   # .env
   SCRAPER_TIMEOUT=45000  # Was 30000
   ```

2. **Reduce Results Per Platform**
   ```env
   SCRAPER_RESULTS_PER_PLATFORM=3  # Was 5
   ```

3. **Optimize Slow Scraper**
   ```javascript
   // Use waitUntil: 'domcontentloaded' instead of 'networkidle'
   await page.goto(url, { waitUntil: 'domcontentloaded' });
   ```

### Task 4: Memory Leaks

**Symptoms:**
- Backend crashes after hours/days
- Increasing memory usage
- "Out of memory" errors

**Diagnosis:**

```bash
# Monitor memory
node --expose-gc src/server.js

# Or use PM2
pm2 start src/server.js --name price-scraper --max-memory-restart 500M
```

**Fix:**

1. **Ensure Browser Cleanup**
   ```javascript
   // In scraper
   try {
     const page = await context.newPage();
     // ... scraping ...
   } finally {
     await page.close(); // Always close
   }
   ```

2. **Restart Browser Pool Periodically**
   ```javascript
   // In orchestrator
   let requestCount = 0;
   
   async scrapeAll(query) {
     requestCount++;
     
     if (requestCount % 100 === 0) {
       await browserPool.shutdown();
       await browserPool.initialize();
     }
     
     // ... rest of code
   }
   ```

### Task 5: Database Growing Too Large

**Symptoms:**
- Disk space running low
- Slow queries
- Large table sizes

**Diagnosis:**

```sql
-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::text)) as size
FROM pg_tables
WHERE schemaname = 'public';
```

**Fix:**

1. **Archive Old Data**
   ```sql
   -- Archive searches older than 90 days
   DELETE FROM searches 
   WHERE timestamp < NOW() - INTERVAL '90 days';
   
   -- Archive product snapshots older than 30 days
   DELETE FROM product_snapshots 
   WHERE timestamp < NOW() - INTERVAL '30 days';
   ```

2. **Set Up Automated Cleanup**
   ```bash
   # Create cleanup script
   cat > cleanup-db.sh << 'EOF'
   #!/bin/bash
   psql -U postgres -d price_comparison << SQL
   DELETE FROM searches WHERE timestamp < NOW() - INTERVAL '90 days';
   DELETE FROM product_snapshots WHERE timestamp < NOW() - INTERVAL '30 days';
   VACUUM ANALYZE;
   SQL
   EOF
   
   chmod +x cleanup-db.sh
   
   # Add to crontab (run weekly)
   crontab -e
   # Add: 0 2 * * 0 /path/to/cleanup-db.sh
   ```

## Adding New Platforms

### Step-by-Step Process

1. **Research Platform**
   ```bash
   node debug-api.js <platform-url>
   ```

2. **Create Scraper File**
   ```bash
   cp backend/src/scrapers/platforms/croma.js \
      backend/src/scrapers/platforms/newplatform.js
   ```

3. **Implement Scraper**
   ```javascript
   export default class NewPlatformScraper extends BaseScraper {
     constructor() {
       super('NewPlatform');
       this.baseUrl = 'https://www.newplatform.com';
     }
     
     async scrape(query, page) {
       // Implement scraping logic
     }
   }
   ```

4. **Test Scraper**
   ```bash
   # Add to test-scraper.js imports first
   node test-scraper.js newplatform "test query"
   ```

5. **Register in Orchestrator**
   ```javascript
   // backend/src/scrapers/orchestrator.js
   import NewPlatformScraper from './platforms/newplatform.js';
   
   this.scrapers = [
     // ... existing scrapers
     new NewPlatformScraper()
   ];
   ```

6. **Update Frontend Colors**
   ```javascript
   // frontend/src/utils/format.js
   const colors = {
     // ... existing colors
     NewPlatform: '#YOUR_COLOR'
   };
   ```

## Updating Dependencies

### Monthly Updates

```bash
# Backend
cd backend
npm outdated
npm update

# Test after update
npm run dev

# Frontend
cd frontend
npm outdated
npm update
npm run dev
```

### Playwright Updates

```bash
cd backend
npm update playwright
npx playwright install chromium
```

## Backup Strategy

### Database Backups

```bash
# Daily backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -U postgres price_comparison > backup_$DATE.sql
# Keep only last 7 days
find . -name "backup_*.sql" -mtime +7 -delete
EOF

chmod +x backup-db.sh

# Add to crontab (run daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/backup-db.sh
```

### Configuration Backups

```bash
# Backup .env and configs
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  backend/.env \
  backend/src/config/ \
  frontend/vite.config.js
```

## Performance Optimization

### Redis Optimization

```bash
# In redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### PostgreSQL Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_searches_query_timestamp 
ON searches(query, timestamp DESC);

CREATE INDEX idx_snapshots_title 
ON product_snapshots USING gin(to_tsvector('english', title));

-- Analyze tables
ANALYZE searches;
ANALYZE product_snapshots;
```

### Node.js Optimization

```bash
# Increase memory limit if needed
node --max-old-space-size=2048 src/server.js
```

## Troubleshooting Checklist

When something breaks:

- [ ] Check if services are running (PostgreSQL, Redis, Node)
- [ ] Review error logs (`tail -f backend/logs/error.log`)
- [ ] Test individual scrapers (`node test-scraper.js <platform>`)
- [ ] Check if platform website is accessible
- [ ] Verify API patterns haven't changed (`node debug-api.js <platform>`)
- [ ] Check disk space (`df -h`)
- [ ] Check memory usage (`free -m` or Task Manager)
- [ ] Restart services if needed
- [ ] Check recent code changes (if any)
- [ ] Review platform's robots.txt and ToS

## Getting Help

1. **Check Logs First**
   ```bash
   tail -100 backend/logs/error.log
   ```

2. **Enable Debug Logging**
   ```env
   # .env
   LOG_LEVEL=debug
   ```

3. **Test in Isolation**
   ```bash
   node test-scraper.js <platform> "simple query"
   ```

4. **Document the Issue**
   - What changed?
   - Error messages?
   - When did it start?
   - Which platform(s)?

## Maintenance Schedule

**Daily:**
- Automated health checks

**Weekly:**
- Review error logs
- Test each platform manually
- Check database size

**Monthly:**
- Update dependencies
- Review performance metrics
- Optimize slow queries
- Clean old logs

**Quarterly:**
- Full system audit
- Update documentation
- Review and update scrapers
- Performance optimization

## Emergency Procedures

### System Down

1. Check services:
   ```bash
   # PostgreSQL
   sudo service postgresql status
   
   # Redis
   redis-cli ping
   
   # Node
   ps aux | grep node
   ```

2. Restart services:
   ```bash
   sudo service postgresql restart
   redis-server &
   cd backend && npm run dev
   ```

### All Scrapers Failing

1. Check internet connection
2. Check if platforms are accessible
3. Review recent changes
4. Rollback if needed:
   ```bash
   git log
   git revert <commit-hash>
   ```

### Data Loss

1. Stop all services
2. Restore from backup:
   ```bash
   psql -U postgres -d price_comparison < backup_YYYYMMDD.sql
   ```
3. Verify data integrity
4. Restart services
