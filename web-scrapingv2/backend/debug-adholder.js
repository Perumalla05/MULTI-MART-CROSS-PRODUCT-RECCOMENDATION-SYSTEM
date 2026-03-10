import { chromium } from 'playwright';

async function debugAdHolder() {
  const query = process.argv[2] || 'oneplus 15r';
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

  const adHolderInfo = await page.evaluate(() => {
    const info = { adHolders: [] };

    // Find all AdHolder containers
    const adHolders = document.querySelectorAll('.AdHolder');

    adHolders.forEach((holder, idx) => {
      const holderInfo = {
        index: idx,
        classes: holder.className,
        dataAsin: holder.getAttribute('data-asin'),
        dataIndex: holder.getAttribute('data-index'),
        celWidget: holder.getAttribute('data-cel-widget'),
        innerTextPreview: holder.innerText.substring(0, 800),
        // Check for product cards inside
        links: [],
        images: [],
        h2s: [],
        prices: [],
        allCsaItemIds: []
      };

      // Find all links with /dp/
      holder.querySelectorAll('a[href*="/dp/"]').forEach(a => {
        holderInfo.links.push({
          href: a.getAttribute('href')?.substring(0, 200),
          text: a.textContent?.trim().substring(0, 100)
        });
      });

      // Find all links (any)
      if (holderInfo.links.length === 0) {
        holder.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
            holderInfo.links.push({
              href: href.substring(0, 200),
              text: a.textContent?.trim().substring(0, 100)
            });
          }
        });
      }

      // Find all images
      holder.querySelectorAll('img').forEach(img => {
        holderInfo.images.push({
          src: img.src?.substring(0, 200),
          alt: img.alt?.substring(0, 100),
          classes: img.className
        });
      });

      // Find h2 elements
      holder.querySelectorAll('h2').forEach(h2 => {
        holderInfo.h2s.push(h2.textContent?.trim().substring(0, 200));
      });

      // Find price elements
      holder.querySelectorAll('.a-price .a-offscreen, .a-price-whole').forEach(p => {
        holderInfo.prices.push(p.textContent?.trim());
      });

      // Find data-csa-c-item-id
      holder.querySelectorAll('[data-csa-c-item-id]').forEach(el => {
        const id = el.getAttribute('data-csa-c-item-id');
        if (!holderInfo.allCsaItemIds.includes(id)) {
          holderInfo.allCsaItemIds.push(id);
        }
      });

      // Also look at the inner container structure
      const innerContainer = holder.querySelector('[class*="container"]');
      if (innerContainer) {
        holderInfo.innerContainerClasses = innerContainer.className.substring(0, 200);
      }

      // Check for product cards with specific structures
      const productCards = holder.querySelectorAll('[class*="card"], [class*="product"], [class*="item"]');
      holderInfo.productCardCount = productCards.length;
      holderInfo.productCardClasses = Array.from(productCards).slice(0, 5).map(c => c.className.substring(0, 100));

      info.adHolders.push(holderInfo);
    });

    return info;
  });

  console.log(`Found ${adHolderInfo.adHolders.length} AdHolder containers\n`);

  for (const holder of adHolderInfo.adHolders) {
    console.log(`\n=== AdHolder ${holder.index} ===`);
    console.log('Classes:', holder.classes);
    console.log('data-asin:', holder.dataAsin);
    console.log('data-index:', holder.dataIndex);
    console.log('cel-widget:', holder.celWidget);
    console.log('Product card count:', holder.productCardCount);

    console.log('\n--- Links ---');
    holder.links.slice(0, 10).forEach((l, i) => {
      console.log(`  ${i + 1}. href: ${l.href}`);
      console.log(`     text: ${l.text}`);
    });

    console.log('\n--- Images ---');
    holder.images.slice(0, 5).forEach((img, i) => {
      console.log(`  ${i + 1}. alt: ${img.alt}`);
      console.log(`     src: ${img.src}`);
    });

    console.log('\n--- H2s ---');
    holder.h2s.forEach((h2, i) => console.log(`  ${i + 1}. ${h2}`));

    console.log('\n--- Prices ---');
    holder.prices.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

    console.log('\n--- CSA Item IDs (ASINs) ---');
    holder.allCsaItemIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));

    console.log('\n--- Inner text preview ---');
    console.log(holder.innerTextPreview);
  }

  console.log('\n\nDone! Browser will close in 10 seconds...');
  await page.waitForTimeout(10000);
  await browser.close();
}

debugAdHolder().catch(console.error);
