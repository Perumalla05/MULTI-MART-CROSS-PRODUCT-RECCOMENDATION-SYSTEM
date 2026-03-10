import { chromium } from 'playwright';

async function debugFlipkartFashion() {
  const query = process.argv[2] || 'nike air force 1';
  console.log(`\nSearching Flipkart for: "${query}"\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN'
  });

  const page = await context.newPage();
  const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const debugInfo = await page.evaluate(() => {
    const info = {
      url: window.location.href,
      dataIdItems: [],
      allProductContainers: [],
      bodyStructure: []
    };

    // Check [data-id] items (current scraper selector)
    const dataIdItems = document.querySelectorAll('[data-id]');
    info.dataIdCount = dataIdItems.length;
    dataIdItems.forEach((item, idx) => {
      if (idx < 3) {
        info.dataIdItems.push({
          index: idx,
          dataId: item.getAttribute('data-id'),
          tagName: item.tagName,
          classes: item.className.substring(0, 200),
          innerTextPreview: item.innerText.substring(0, 300),
          hasImg: !!item.querySelector('img'),
          imgAlt: item.querySelector('img')?.alt?.substring(0, 100) || '',
          imgSrc: item.querySelector('img')?.src?.substring(0, 200) || '',
          links: Array.from(item.querySelectorAll('a[href]')).slice(0, 3).map(a => ({
            href: a.getAttribute('href')?.substring(0, 200),
            text: a.textContent?.trim().substring(0, 100)
          })),
          priceTexts: Array.from(item.querySelectorAll('*')).filter(el =>
            el.textContent?.includes('₹') && el.children.length === 0
          ).slice(0, 5).map(el => el.textContent.trim().substring(0, 100))
        });
      }
    });

    // Look for other common product container patterns
    const selectors = [
      'a[href*="/p/"]',           // Product links
      '[class*="product"]',        // Product class
      '[class*="card"]',           // Card class
      '[class*="item"]',           // Item class
      'div[class] > a > div > div > img', // Nested img in card structure
    ];

    for (const selector of selectors) {
      const els = document.querySelectorAll(selector);
      info.allProductContainers.push({
        selector,
        count: els.length,
        samples: Array.from(els).slice(0, 2).map(el => ({
          tagName: el.tagName,
          classes: el.className?.substring(0, 150) || '',
          parentClasses: el.parentElement?.className?.substring(0, 150) || '',
          textPreview: el.textContent?.trim().substring(0, 200) || '',
          href: el.getAttribute('href')?.substring(0, 200) || ''
        }))
      });
    }

    // Look at the main content area structure
    // Flipkart fashion usually uses a grid of <a> tags with product cards
    const mainContent = document.querySelector('#container') || document.body;
    const topLevelDivs = mainContent.querySelectorAll(':scope > div');

    // Find all <a> links that contain product images
    const productLinks = document.querySelectorAll('a[href*="/p/"]');
    info.productLinkCount = productLinks.length;

    Array.from(productLinks).slice(0, 3).forEach((link, idx) => {
      const container = link.closest('[data-id]') || link.parentElement;
      info.bodyStructure.push({
        index: idx,
        href: link.getAttribute('href')?.substring(0, 200),
        hasDataIdParent: !!link.closest('[data-id]'),
        containerTag: container.tagName,
        containerClasses: container.className?.substring(0, 200) || '',
        containerDataId: container.getAttribute('data-id') || 'none',
        // Get the card content
        img: link.querySelector('img') ? {
          alt: link.querySelector('img').alt?.substring(0, 100),
          src: link.querySelector('img').src?.substring(0, 200)
        } : null,
        innerText: link.innerText.substring(0, 400),
        // Walk up to find the grid container
        parentChain: (() => {
          const chain = [];
          let el = link.parentElement;
          for (let d = 0; d < 5 && el; d++) {
            chain.push({
              tag: el.tagName,
              classes: el.className?.substring(0, 100) || '',
              dataId: el.getAttribute('data-id') || '',
              childCount: el.children.length
            });
            el = el.parentElement;
          }
          return chain;
        })()
      });
    });

    // Also check if there are any divs with many child <a> tags (grid layout)
    const allDivs = document.querySelectorAll('div');
    const gridCandidates = [];
    allDivs.forEach(div => {
      const childLinks = div.querySelectorAll(':scope > div > a[href*="/p/"], :scope > a[href*="/p/"]');
      if (childLinks.length >= 4) {
        gridCandidates.push({
          classes: div.className?.substring(0, 200) || '',
          childLinkCount: childLinks.length,
          dataId: div.getAttribute('data-id') || 'none',
          childStructure: Array.from(div.children).slice(0, 2).map(c => ({
            tag: c.tagName,
            classes: c.className?.substring(0, 100) || '',
            hasLink: !!c.querySelector('a[href*="/p/"]')
          }))
        });
      }
    });
    info.gridCandidates = gridCandidates.slice(0, 3);

    return info;
  });

  console.log('=== URL ===');
  console.log(debugInfo.url);

  console.log(`\n=== [data-id] items: ${debugInfo.dataIdCount} ===`);
  for (const item of debugInfo.dataIdItems) {
    console.log(`\n--- Item ${item.index} ---`);
    console.log('data-id:', item.dataId);
    console.log('tag:', item.tagName, 'classes:', item.classes);
    console.log('img alt:', item.imgAlt);
    console.log('links:', JSON.stringify(item.links, null, 2));
    console.log('price texts:', item.priceTexts);
    console.log('text preview:', item.innerTextPreview);
  }

  console.log(`\n=== Product links (a[href*="/p/"]): ${debugInfo.productLinkCount} ===`);
  for (const item of debugInfo.bodyStructure) {
    console.log(`\n--- Product Link ${item.index} ---`);
    console.log('href:', item.href);
    console.log('hasDataIdParent:', item.hasDataIdParent);
    console.log('container:', item.containerTag, item.containerClasses);
    console.log('img:', item.img);
    console.log('innerText:', item.innerText);
    console.log('parent chain:');
    item.parentChain.forEach((p, d) => {
      console.log(`  ${d}: <${p.tag}> classes="${p.classes}" data-id="${p.dataId}" children=${p.childCount}`);
    });
  }

  console.log('\n=== Grid candidates ===');
  for (const grid of debugInfo.gridCandidates) {
    console.log('\nclasses:', grid.classes);
    console.log('child links:', grid.childLinkCount);
    console.log('data-id:', grid.dataId);
    console.log('child structure:', JSON.stringify(grid.childStructure, null, 2));
  }

  console.log('\n=== Selector counts ===');
  for (const s of debugInfo.allProductContainers) {
    console.log(`${s.selector}: ${s.count}`);
    if (s.count > 0 && s.count < 50) {
      s.samples.forEach(sample => {
        console.log(`  tag=${sample.tagName} classes="${sample.classes}" text="${sample.textPreview}"`);
      });
    }
  }

  console.log('\n\nDone! Browser will close in 15 seconds...');
  await page.waitForTimeout(15000);
  await browser.close();
}

debugFlipkartFashion().catch(console.error);
