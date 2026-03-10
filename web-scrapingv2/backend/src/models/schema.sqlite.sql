-- Search queries table
CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_results INTEGER DEFAULT 0,
  successful_platforms INTEGER DEFAULT 0,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query);
CREATE INDEX IF NOT EXISTS idx_searches_timestamp ON searches(timestamp DESC);

-- Product snapshots table
CREATE TABLE IF NOT EXISTS product_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id INTEGER,
  source VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  base_price REAL NOT NULL,
  mrp REAL,
  discount_percent REAL,
  effective_price REAL,
  product_url TEXT,
  image_url TEXT,
  availability INTEGER DEFAULT 1,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_search ON product_snapshots(search_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_source ON product_snapshots(source);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON product_snapshots(timestamp DESC);

-- Platform health tracking
CREATE TABLE IF NOT EXISTS platform_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_platform ON platform_health(platform, timestamp DESC);
