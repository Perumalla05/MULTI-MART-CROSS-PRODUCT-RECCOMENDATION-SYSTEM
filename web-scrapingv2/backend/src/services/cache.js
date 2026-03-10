import { createClient } from 'redis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class CacheService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;

    // Don't wait for Redis - just skip it if not available
    logger.warn('Redis disabled - caching will not work');
    this.connected = false;
    this.client = null;
  }

  generateKey(query) {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, '_');
    return `search:${normalized}`;
  }

  async get(query) {
    if (!this.connected) return null;

    try {
      const key = this.generateKey(query);
      const data = await this.client.get(key);
      
      if (data) {
        logger.info('Cache hit', { query });
        return JSON.parse(data);
      }
      
      logger.info('Cache miss', { query });
      return null;
    } catch (error) {
      logger.error('Cache get failed', { query, error: error.message });
      return null;
    }
  }

  async set(query, data) {
    if (!this.connected) return false;

    try {
      const key = this.generateKey(query);
      await this.client.setEx(
        key,
        config.redis.cacheTTL,
        JSON.stringify(data)
      );
      
      logger.info('Cache set', { query, ttl: config.redis.cacheTTL });
      return true;
    } catch (error) {
      logger.error('Cache set failed', { query, error: error.message });
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis disconnected');
    }
  }
}

export default new CacheService();
