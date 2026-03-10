import browserPool from './src/services/browserPool.js';
import logger from './src/utils/logger.js';

// Import scrapers
import AmazonScraper from './src/scrapers/platforms/amazon.js';
import FlipkartScraper from './src/scrapers/platforms/flipkart.js';
import CromaScraper from './src/scrapers/platforms/croma.js';

const scrapers = {
  amazon: AmazonScraper,
  flipkart: FlipkartScraper,
  croma: CromaScraper
};

async function testScraper(scraperName, query) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${scraperName.toUpperCase()} Scraper`);
  console.log(`Query: "${query}"`);
  console.log('='.repeat(60));

  const ScraperClass = scrapers[scraperName.toLowerCase()];
  
  if (!ScraperClass) {
    console.error(`❌ Scraper not found: ${scraperName}`);
    console.log(`Available scrapers: ${Object.keys(scrapers).join(', ')}`);
    return;
  }

  try {
    await browserPool.initialize();
    
    const scraper = new ScraperClass();
    const context = await browserPool.getContext(scraper.platformName);
    
    const startTime = Date.now();
    const results = await scraper.execute(query, context);
    const duration = Date.now() - startTime;

    console.log(`\n✅ Scraping completed in ${duration}ms`);
    console.log(`📦 Found ${results.length} products\n`);

    if (results.length > 0) {
      console.log('Sample Products:\n');
      results.slice(0, 3).forEach((product, idx) => {
        console.log(`${idx + 1}. ${product.title}`);
        console.log(`   Price: ₹${product.basePrice}`);
        if (product.mrp) {
          console.log(`   MRP: ₹${product.mrp} (${product.discountPercent}% off)`);
        }
        console.log(`   URL: ${product.productUrl.substring(0, 80)}...`);
        console.log('');
      });

      console.log('Full JSON output:');
      console.log(JSON.stringify(results[0], null, 2));
    } else {
      console.log('⚠️  No products found. Possible reasons:');
      console.log('   - Platform changed their structure');
      console.log('   - Network timeout');
      console.log('   - Rate limited');
      console.log('   - Invalid selectors');
      console.log('\nCheck logs for details:');
      console.log('   tail -f logs/error.log');
    }

  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    console.error(error.stack);
  } finally {
    await browserPool.shutdown();
  }
}

// Parse command line arguments
const scraperName = process.argv[2];
const query = process.argv[3] || 'iPhone 15';

if (!scraperName) {
  console.log('Usage: node test-scraper.js <scraper> [query]');
  console.log('\nExamples:');
  console.log('  node test-scraper.js amazon "iPhone 15"');
  console.log('  node test-scraper.js flipkart "Samsung TV"');
  console.log('  node test-scraper.js croma "Sony headphones"');
  console.log(`\nAvailable scrapers: ${Object.keys(scrapers).join(', ')}`);
  process.exit(1);
}

testScraper(scraperName, query);
