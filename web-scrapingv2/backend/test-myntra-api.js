import playwright from 'playwright';

async function testMyntraAPI() {
  console.log('\n🔍 Testing Myntra API approach\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();

  // Try different approaches
  const urls = [
    'https://www.myntra.com/nike-shoes',
    'https://www.myntra.com/search?q=nike%20shoes',
    'https://www.myntra.com/gateway/v2/search/nike%20shoes'
  ];

  for (const url of urls) {
    console.log(`\nTrying: ${url}`);
    try {
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      console.log(`Status: ${response.status()}`);
      
      if (response.ok()) {
        console.log('✅ Success!');
        const title = await page.title();
        console.log('Title:', title);
        
        await page.waitForTimeout(3000);
        const products = await page.$$('li.product-base');
        console.log(`Products found: ${products.length}`);
        
        if (products.length > 0) {
          console.log('\n✅ This URL works!');
          break;
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message.substring(0, 100)}`);
    }
  }

  await page.waitForTimeout(30000);
  await browser.close();
}

testMyntraAPI();
