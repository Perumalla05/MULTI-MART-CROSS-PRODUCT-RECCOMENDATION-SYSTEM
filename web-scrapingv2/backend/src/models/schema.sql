-- Search queries table
CREATE TABLE IF NOT EXISTS searches (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_results INTEGER DEFAULT 0,
  successful_platforms INTEGER DEFAULT 0,
  duration_ms INTEGER
);

CREATE INDEX idx_searches_query ON searches(query);
CREATE INDEX idx_searches_timestamp ON searches(timestamp DESC);

-- Product snapshots table
CREATE TABLE IF NOT EXISTS product_snapshots (
  id SERIAL PRIMARY KEY,
  search_id INTEGER REFERENCES searches(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  mrp DECIMAL(10, 2),
  discount_percent DECIMAL(5, 2),
  effective_price DECIMAL(10, 2),
  product_url TEXT,
  image_url TEXT,
  availability BOOLEAN DEFAULT true,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_snapshots_search ON product_snapshots(search_id);
CREATE INDEX idx_snapshots_source ON product_snapshots(source);
CREATE INDEX idx_snapshots_timestamp ON product_snapshots(timestamp DESC);

-- Platform health tracking
CREATE TABLE IF NOT EXISTS platform_health (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success', 'timeout', 'error'
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_platform ON platform_health(platform, timestamp DESC);
