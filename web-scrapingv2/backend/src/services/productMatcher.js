export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTokens(title) {
  const normalized = normalizeTitle(title);
  return new Set(normalized.split(' ').filter(t => t.length > 2));
}

export function calculateSimilarity(title1, title2) {
  const tokens1 = extractTokens(title1);
  const tokens2 = extractTokens(title2);

  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size; // Jaccard similarity
}

export function groupSimilarProducts(products, threshold = 0.4) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < products.length; i++) {
    if (used.has(i)) continue;

    const group = [products[i]];
    used.add(i);

    for (let j = i + 1; j < products.length; j++) {
      if (used.has(j)) continue;

      const similarity = calculateSimilarity(
        products[i].title,
        products[j].title
      );

      if (similarity >= threshold) {
        group.push(products[j]);
        used.add(j);
      }
    }

    groups.push({
      products: group,
      representativeTitle: products[i].title,
      platformCount: new Set(group.map(p => p.source)).size
    });
  }

  // Sort by platform count (more platforms = better comparison)
  return groups.sort((a, b) => b.platformCount - a.platformCount);
}
