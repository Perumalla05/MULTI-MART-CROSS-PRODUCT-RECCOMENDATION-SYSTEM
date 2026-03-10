import playwright from 'playwright';

async function findCromaProductClass() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();

  const searchUrl = 'https://www.croma.com/searchB?q=oneplus%2015r%3Arelevance&text=oneplus%2015r';
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('\n🔍 Finding Croma product containers\n');

  // Get all elements with product links
  const result = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const containers = [];
    
    links.forEach(link => {
      let parent = link.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        containers.push({
          tag: parent.tagName,
          className: parent.className,
          id: parent.id
        });
        parent = parent.parentElement;
      }
    });
    
    return containers.slice(0, 10);
  });

  console.log('Parent hierarchy of product links:');
  result.forEach((item, i) => {
    console.log(`${i}. <${item.tag}> class="${item.className.substring(0, 80)}" id="${item.id}"`);
  });

  await page.waitForTimeout(30000);
  await browser.close();
}

findCromaProductClass();
