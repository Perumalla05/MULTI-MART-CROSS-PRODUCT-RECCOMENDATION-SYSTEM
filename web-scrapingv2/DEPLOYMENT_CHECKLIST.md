# Production Deployment Checklist

## Pre-Deployment

### Infrastructure Setup
- [ ] Provision server (minimum 2GB RAM, 2 CPU cores)
- [ ] Install Node.js 18+
- [ ] Install PostgreSQL 14+
- [ ] Install Redis 7+
- [ ] Install Nginx (reverse proxy)
- [ ] Configure firewall (allow 80, 443, block 3000, 5432, 6379)
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Configure domain DNS

### Database Setup
- [ ] Create production database
- [ ] Run schema migrations
- [ ] Set up database user with limited permissions
- [ ] Configure connection pooling
- [ ] Set up automated backups
- [ ] Test backup restoration

### Redis Setup
- [ ] Configure Redis persistence (AOF + RDB)
- [ ] Set maxmemory policy
- [ ] Configure password authentication
- [ ] Test Redis failover

### Application Setup
- [ ] Clone repository
- [ ] Install dependencies (backend + frontend)
- [ ] Install Playwright browsers
- [ ] Build frontend: `npm run build`
- [ ] Configure environment variables
- [ ] Test application locally

## Security Hardening

### Server Security
- [ ] Update all packages: `apt update && apt upgrade`
- [ ] Configure SSH key-only authentication
- [ ] Disable root login
- [ ] Install fail2ban
- [ ] Configure UFW firewall
- [ ] Set up automatic security updates

### Application Security
- [ ] Set NODE_ENV=production
- [ ] Use strong database passwords
- [ ] Use Redis password authentication
- [ ] Disable debug logging in production
- [ ] Remove .env from version control
- [ ] Set secure file permissions (chmod 600 .env)
- [ ] Configure CORS properly
- [ ] Add rate limiting middleware
- [ ] Sanitize user inputs

### Database Security
- [ ] Use non-root database user
- [ ] Restrict database access to localhost
- [ ] Enable SSL for database connections
- [ ] Regular security audits

## Environment Configuration

### Backend .env (Production)
```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=price_comparison
DB_USER=scraper_user
DB_PASSWORD=<strong-password>

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_CACHE_TTL=900

# Scraper
SCRAPER_TIMEOUT=30000
SCRAPER_MAX_RETRIES=3
SCRAPER_CONCURRENT_LIMIT=2
SCRAPER_RESULTS_PER_PLATFORM=5

# Logging
LOG_LEVEL=info
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/price-scraper/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

## Process Management

### PM2 Setup
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'price-scraper-backend',
    script: './src/server.js',
    cwd: '/var/www/price-scraper/backend',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Systemd Service (Alternative)
```bash
cat > /etc/systemd/system/price-scraper.service << 'EOF'
[Unit]
Description=Price Scraper Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/price-scraper/backend
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=price-scraper
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable price-scraper
systemctl start price-scraper
```

## Monitoring Setup

### Log Rotation
```bash
cat > /etc/logrotate.d/price-scraper << 'EOF'
/var/www/price-scraper/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### Health Check Script
```bash
cat > /usr/local/bin/check-price-scraper.sh << 'EOF'
#!/bin/bash

HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "Health check failed: HTTP $RESPONSE"
    pm2 restart price-scraper-backend
    echo "Service restarted at $(date)" >> /var/log/price-scraper-restarts.log
fi
EOF

chmod +x /usr/local/bin/check-price-scraper.sh

# Add to crontab (check every 5 minutes)
crontab -e
# Add: */5 * * * * /usr/local/bin/check-price-scraper.sh
```

### Database Monitoring
```sql
-- Create monitoring view
CREATE VIEW platform_health_summary AS
SELECT 
    platform,
    status,
    COUNT(*) as count,
    MAX(timestamp) as last_seen
FROM platform_health
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY platform, status;

-- Query health
SELECT * FROM platform_health_summary;
```

## Backup Strategy

### Database Backup
```bash
cat > /usr/local/bin/backup-database.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/price-scraper"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="db_backup_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

# Backup
pg_dump -U scraper_user price_comparison | gzip > $BACKUP_DIR/$FILENAME

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/$FILENAME s3://your-bucket/backups/

echo "Backup completed: $FILENAME"
EOF

chmod +x /usr/local/bin/backup-database.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-database.sh
```

### Redis Backup
```bash
# Configure in redis.conf
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Backup script
cat > /usr/local/bin/backup-redis.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/price-scraper"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Trigger save
redis-cli BGSAVE

# Wait for save to complete
sleep 5

# Copy dump
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Keep only last 7 days
find $BACKUP_DIR -name "redis_*.rdb" -mtime +7 -delete

echo "Redis backup completed"
EOF

chmod +x /usr/local/bin/backup-redis.sh
```

## Performance Optimization

### Node.js Optimization
```bash
# Increase memory limit if needed
node --max-old-space-size=2048 src/server.js
```

### PostgreSQL Optimization
```sql
-- Optimize queries
ANALYZE searches;
ANALYZE product_snapshots;

-- Add indexes
CREATE INDEX CONCURRENTLY idx_searches_query_timestamp 
ON searches(query, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_snapshots_search_source 
ON product_snapshots(search_id, source);

-- Vacuum
VACUUM ANALYZE;
```

### Redis Optimization
```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
tcp-backlog 511
timeout 300
```

### Nginx Optimization
```nginx
# Enable gzip
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;

# Enable caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Testing in Production

### Smoke Tests
```bash
# Health check
curl https://yourdomain.com/health

# API test
curl "https://yourdomain.com/api/search?q=test"

# Frontend test
curl https://yourdomain.com/
```

### Load Testing
```bash
# Install Apache Bench
apt install apache2-utils

# Test API endpoint
ab -n 100 -c 10 "https://yourdomain.com/api/search?q=iphone"

# Analyze results
# - Requests per second
# - Time per request
# - Failed requests
```

## Monitoring & Alerts

### Set Up Monitoring
- [ ] Server metrics (CPU, RAM, Disk)
- [ ] Application logs
- [ ] Database performance
- [ ] Redis memory usage
- [ ] API response times
- [ ] Error rates

### Alert Thresholds
- [ ] CPU > 80% for 5 minutes
- [ ] Memory > 90%
- [ ] Disk > 85%
- [ ] API errors > 10% of requests
- [ ] Response time > 10 seconds
- [ ] Database connections > 80% of max

### Tools (Choose One)
- [ ] Prometheus + Grafana
- [ ] Datadog
- [ ] New Relic
- [ ] CloudWatch (if on AWS)
- [ ] Simple: Email alerts from cron jobs

## Post-Deployment

### Immediate Checks (First Hour)
- [ ] Application is running
- [ ] Health endpoint responds
- [ ] Can perform search
- [ ] Results are cached
- [ ] Database is logging
- [ ] No errors in logs
- [ ] SSL certificate valid
- [ ] All platforms working

### First Day Checks
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify backups ran
- [ ] Test all platforms
- [ ] Check cache hit rate
- [ ] Monitor memory usage

### First Week Checks
- [ ] Review all logs
- [ ] Analyze performance trends
- [ ] Check database growth
- [ ] Verify backup restoration
- [ ] Test failover scenarios
- [ ] Update documentation

## Rollback Plan

### If Deployment Fails
```bash
# Stop new version
pm2 stop price-scraper-backend

# Restore previous version
cd /var/www/price-scraper
git checkout <previous-commit>
cd backend && npm install
cd ../frontend && npm install && npm run build

# Restart
pm2 restart price-scraper-backend

# Verify
curl http://localhost:3000/health
```

### If Database Issues
```bash
# Restore from backup
gunzip < /var/backups/price-scraper/db_backup_YYYYMMDD.sql.gz | \
  psql -U scraper_user price_comparison
```

## Maintenance Schedule

### Daily
- [ ] Check error logs
- [ ] Verify backups completed
- [ ] Monitor disk space

### Weekly
- [ ] Review performance metrics
- [ ] Test all platforms
- [ ] Check database size
- [ ] Review security logs

### Monthly
- [ ] Update dependencies
- [ ] Security patches
- [ ] Performance optimization
- [ ] Backup restoration test

### Quarterly
- [ ] Full system audit
- [ ] Disaster recovery drill
- [ ] Capacity planning
- [ ] Documentation update

## Emergency Contacts

```
System Admin: [Name] - [Phone] - [Email]
Database Admin: [Name] - [Phone] - [Email]
Developer: [Name] - [Phone] - [Email]
```

## Documentation

- [ ] Update README with production URLs
- [ ] Document any custom configurations
- [ ] Create runbook for common issues
- [ ] Document backup/restore procedures
- [ ] Create incident response plan

## Sign-Off

- [ ] Development team approval
- [ ] Security review completed
- [ ] Performance testing passed
- [ ] Backup strategy verified
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Stakeholders notified

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Verified By:** _______________

**Status:** ⬜ Success  ⬜ Partial  ⬜ Failed

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________
