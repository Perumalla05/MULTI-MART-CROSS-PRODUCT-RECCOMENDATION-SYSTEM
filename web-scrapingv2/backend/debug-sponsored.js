import { chromium } from 'playwright';

async function debugSponsoredSection() {
  const query = process.argv[2] || 'oneplus 13r';
  console.log(`\nSearching Amazon for: "${query}"\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN'
  });

  const page = await context.newPage();
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 1. Find all elements containing "Sponsored" text and dump their parent structure
  const sponsoredInfo = await page.evaluate(() => {
    const info = {
      sponsoredTextLocations: [],
      potentialContainers: [],
      allDataComponentTypes: [],
      allCelWidgets: [],
      sponsoredParentChains: []
    };

    // Find all unique data-component-type values on the page
    document.querySelectorAll('[data-component-type]').forEach(el => {
      const type = el.getAttribute('data-component-type');
      if (!info.allDataComponentTypes.includes(type)) {
        info.allDataComponentTypes.push(type);
      }
    });

    // Find all unique data-cel-widget values that might be sponsored
    document.querySelectorAll('[data-cel-widget]').forEach(el => {
      const widget = el.getAttribute('data-cel-widget');
      if (widget && (widget.includes('sp') || widget.includes('MAIN') || widget.includes('sponsor') || widget.includes('ad') || widget.includes('AD'))) {
        if (!info.allCelWidgets.includes(widget)) {
          info.allCelWidgets.push(widget);
        }
      }
    });

    // Walk the DOM to find "Sponsored" text nodes and trace their parent chain
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let count = 0;
    while ((node = walker.nextNode()) && count < 20) {
      if (node.textContent.trim() === 'Sponsored') {
        count++;
        const chain = [];
        let current = node.parentElement;
        for (let depth = 0; depth < 15 && current; depth++) {
          const attrs = {};
          for (const attr of current.attributes) {
            if (['class', 'id', 'data-component-type', 'data-cel-widget', 'data-asin', 'data-index', 'role'].includes(attr.name)) {
              attrs[attr.name] = attr.value;
            }
          }
          chain.push({
            tag: current.tagName.toLowerCase(),
            attrs,
            childCount: current.children.length
          });
          current = current.parentElement;
        }
        info.sponsoredParentChains.push(chain);
      }
    }

    // For each "Sponsored" text, find the nearest product-like ancestor and dump its structure
    const sponsoredElements = [];
    document.querySelectorAll('span, div').forEach(el => {
      if (el.textContent.trim() === 'Sponsored' && el.children.length === 0) {
        sponsoredElements.push(el);
      }
    });

    for (let i = 0; i < Math.min(sponsoredElements.length, 5); i++) {
      const el = sponsoredElements[i];
      // Walk up to find a meaningful container (with data-asin, or a large container)
      let container = el.parentElement;
      for (let depth = 0; depth < 15 && container; depth++) {
        const asin = container.getAttribute('data-asin');
        const celWidget = container.getAttribute('data-cel-widget');
        const componentType = container.getAttribute('data-component-type');

        if (asin || celWidget || componentType || container.classList.contains('s-result-item')) {
          // Found a meaningful container - dump its outer HTML (truncated)
          const html = container.outerHTML;
          info.potentialContainers.push({
            tag: container.tagName.toLowerCase(),
            asin: asin || null,
            celWidget: celWidget || null,
            componentType: componentType || null,
            classes: container.className.substring(0, 200),
            htmlPreview: html.substring(0, 1500),
            // Check what product info is inside
            hasH2: !!container.querySelector('h2'),
            hasPrice: !!container.querySelector('.a-price-whole, .a-price .a-offscreen'),
            hasImage: !!container.querySelector('img'),
            hasLink: !!container.querySelector('a[href*="/dp/"]'),
            innerTextPreview: container.innerText.substring(0, 500)
          });
          break;
        }
        container = container.parentElement;
      }
    }

    return info;
  });

  console.log('=== ALL data-component-type values on page ===');
  console.log(JSON.stringify(sponsoredInfo.allDataComponentTypes, null, 2));

  console.log('\n=== Relevant data-cel-widget values ===');
  console.log(JSON.stringify(sponsoredInfo.allCelWidgets, null, 2));

  console.log('\n=== Sponsored text parent chains (first 3) ===');
  for (let i = 0; i < Math.min(sponsoredInfo.sponsoredParentChains.length, 3); i++) {
    console.log(`\n--- Chain ${i + 1} (child → parent) ---`);
    sponsoredInfo.sponsoredParentChains[i].forEach((node, depth) => {
      console.log(`${'  '.repeat(depth)}${node.tag}`, JSON.stringify(node.attrs));
    });
  }

  console.log('\n=== Sponsored product containers ===');
  for (let i = 0; i < sponsoredInfo.potentialContainers.length; i++) {
    const c = sponsoredInfo.potentialContainers[i];
    console.log(`\n--- Container ${i + 1} ---`);
    console.log('Tag:', c.tag);
    console.log('ASIN:', c.asin);
    console.log('cel-widget:', c.celWidget);
    console.log('component-type:', c.componentType);
    console.log('Classes:', c.classes);
    console.log('Has h2:', c.hasH2, '| Has price:', c.hasPrice, '| Has image:', c.hasImage, '| Has link:', c.hasLink);
    console.log('Inner text preview:', c.innerTextPreview.substring(0, 300));
    console.log('\nHTML preview:');
    console.log(c.htmlPreview);
  }

  console.log('\n\nDone! Browser will close in 10 seconds...');
  await page.waitForTimeout(10000);
  await browser.close();
}

debugSponsoredSection().catch(console.error);
