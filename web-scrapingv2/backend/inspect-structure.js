import playwright from 'playwright';

async function inspectStructure() {
  console.log('🔍 Inspecting Amazon product structure...\n');

  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded' });
  await page.fill('#twotabsearchtextbox', 'oneplus 15r');
  await page.click('#nav-search-submit-button');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  const containers = await page.$$('[data-component-type="s-search-result"]');
  console.log(`Found ${containers.length} containers\n`);

  if (containers.length > 0) {
    const firstContainer = containers[0];
    const html = await firstContainer.innerHTML();
    
    console.log('=== FIRST PRODUCT HTML (first 2000 chars) ===\n');
    console.log(html.substring(0, 2000));
    console.log('\n...\n');

    // Try different selectors for title
    console.log('=== TESTING TITLE SELECTORS ===');
    const titleSelectors = [
      'h2 a span',
      'h2 span',
      'h2 a',
      'h2',
      '.a-size-medium',
      '.a-text-normal'
    ];

    for (const selector of titleSelectors) {
      const el = await firstContainer.$(selector);
      if (el) {
        const text = await el.textContent();
        console.log(`✅ ${selector}: "${text.trim().substring(0, 80)}"`);
      } else {
        console.log(`❌ ${selector}: NOT FOUND`);
      }
    }

    // Try different selectors for URL
    console.log('\n=== TESTING URL SELECTORS ===');
    const urlSelectors = [
      'h2 a',
      'a.a-link-normal',
      'a[href*="/dp/"]',
      '.a-link-normal.s-no-outline'
    ];

    for (const selector of urlSelectors) {
      const el = await firstContainer.$(selector);
      if (el) {
        const href = await el.getAttribute('href');
        console.log(`✅ ${selector}: "${href?.substring(0, 80)}"`);
      } else {
        console.log(`❌ ${selector}: NOT FOUND`);
      }
    }
  }

  console.log('\n✅ Inspection complete. Browser stays open for 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
}

inspectStructure();
