import { chromium } from 'playwright';

async function debugAPIs(platform, searchUrl, searchQuery) {
  console.log(`\n🔍 Debugging ${platform} APIs\n`);
  console.log(`URL: ${searchUrl}`);
  console.log(`Query: ${searchQuery}\n`);

  const browser = await chromium.launch({ 
    headless: false // Set to true to run in background
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN'
  });
  
  const page = await context.newPage();

  const apiCalls = [];

  // Capture all requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('search') || url.includes('query')) {
      console.log('→ REQUEST:', request.method(), url);
    }
  });

  // Capture all responses
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';

    // Filter for potential API calls
    if (contentType.includes('json') || url.includes('api')) {
      console.log(`\n← RESPONSE [${status}]:`, url);
      console.log('Content-Type:', contentType);

      try {
        const data = await response.json();
        console.log('Response Data:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
        
        apiCalls.push({
          url,
          status,
          contentType,
          data
        });
      } catch (e) {
        console.log('(Not valid JSON or failed to parse)');
      }
    }
  });

  // Navigate and search
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('\n📊 Summary:');
  console.log(`Total API calls captured: ${apiCalls.length}`);
  
  if (apiCalls.length > 0) {
    console.log('\n🎯 Potential API endpoints:');
    apiCalls.forEach((call, idx) => {
      console.log(`${idx + 1}. ${call.url}`);
    });
  } else {
    console.log('\n⚠️  No JSON API calls detected. Platform may use:');
    console.log('   - Server-side rendering');
    console.log('   - Encrypted responses');
    console.log('   - GraphQL (check for /graphql endpoints)');
    console.log('   → Recommend using DOM scraping for this platform');
  }

  await browser.close();
}

// Test different platforms
const platforms = [
  {
    name: 'Amazon India',
    url: 'https://www.amazon.in/s?k=iphone',
    query: 'iphone'
  },
  {
    name: 'Flipkart',
    url: 'https://www.flipkart.com/search?q=iphone',
    query: 'iphone'
  },
  {
    name: 'Croma',
    url: 'https://www.croma.com/search?q=iphone',
    query: 'iphone'
  }
];

// Run for specific platform or all
const targetPlatform = process.argv[2];

if (targetPlatform) {
  const platform = platforms.find(p => 
    p.name.toLowerCase().includes(targetPlatform.toLowerCase())
  );
  
  if (platform) {
    debugAPIs(platform.name, platform.url, platform.query);
  } else {
    console.log('Platform not found. Available: amazon, flipkart, croma');
  }
} else {
  console.log('Usage: node debug-api.js <platform>');
  console.log('Example: node debug-api.js amazon');
  console.log('\nAvailable platforms:', platforms.map(p => p.name).join(', '));
}
