import { chromium } from 'playwright';
import logger from '../utils/logger.js';

class BrowserPool {
  constructor() {
    this.browser = null;
    this.contexts = new Map();
  }

  async initialize() {
    if (this.browser) return;
    
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox'
        ]
      });
      logger.info('Browser pool initialized');
    } catch (error) {
      logger.error('Failed to initialize browser', { error: error.message });
      throw error;
    }
  }

  async getContext(platform) {
    if (!this.browser) {
      await this.initialize();
    }

    if (this.contexts.has(platform)) {
      return this.contexts.get(platform);
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      }
    });

    // Add script to remove webdriver flag
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
    });

    this.contexts.set(platform, context);
    return context;
  }

  async closeContext(platform) {
    const context = this.contexts.get(platform);
    if (context) {
      await context.close();
      this.contexts.delete(platform);
    }
  }

  async shutdown() {
    for (const [platform, context] of this.contexts) {
      await context.close();
    }
    this.contexts.clear();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('Browser pool shutdown');
  }
}

export default new BrowserPool();
