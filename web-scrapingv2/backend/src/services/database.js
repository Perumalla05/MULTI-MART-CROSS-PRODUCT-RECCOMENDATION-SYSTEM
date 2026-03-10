import Database from 'better-sqlite3';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async connect() {
    // Skip database for now - just log to console
    logger.info('Database disabled - running without history logging');
    this.db = null;
  }

  async logSearch(query, results, duration) {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(
        `INSERT INTO searches (query, total_results, successful_platforms, duration_ms)
         VALUES (?, ?, ?, ?)`
      );
      
      const info = stmt.run(
        query,
        results.totalProducts,
        Object.values(results.platforms).filter(p => p.success).length,
        duration
      );

      return info.lastInsertRowid;
    } catch (error) {
      logger.error('Failed to log search', { error: error.message });
      return null;
    }
  }

  async logProducts(searchId, products) {
    if (!this.db || !searchId) return;

    try {
      const stmt = this.db.prepare(
        `INSERT INTO product_snapshots 
        (search_id, source, title, base_price, mrp, discount_percent, 
         effective_price, product_url, image_url, availability)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const insert = this.db.transaction((products) => {
        for (const p of products) {
          stmt.run(
            searchId,
            p.source,
            p.title,
            p.basePrice,
            p.mrp,
            p.discountPercent,
            p.effectivePrice,
            p.productUrl,
            p.imageUrl,
            p.availability ? 1 : 0
          );
        }
      });

      insert(products);
    } catch (error) {
      logger.error('Failed to log products', { error: error.message });
    }
  }

  async disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database disconnected');
    }
  }
}

export default new DatabaseService();
