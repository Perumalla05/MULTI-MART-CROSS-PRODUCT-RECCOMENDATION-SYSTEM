import ProductCard from './ProductCard';

export default function ResultsGrid({ results }) {
  if (!results) return null;

  const { products, bestDeals, platforms, errors } = results;

  const failedPlatforms = Object.keys(errors || {});
  const lowestBasePriceId = bestDeals?.lowestBasePrice?.productUrl;
  const lowestEffectiveId = bestDeals?.lowestEffectivePrice?.productUrl;

  return (
    <div>
      <div style={styles.summary}>
        <h2 style={styles.heading}>
          Found {products.length} products across {Object.keys(platforms).length} platforms
        </h2>
        {results.cached && <span style={styles.cached}>Cached Result</span>}
      </div>

      {failedPlatforms.length > 0 && (
        <div style={styles.warning}>
          ⚠️ Could not fetch from: {failedPlatforms.join(', ')}
        </div>
      )}

      {products.length === 0 ? (
        <div style={styles.empty}>No products found. Try a different search term.</div>
      ) : (
        <div style={styles.grid}>
          {products.map((product, idx) => (
            <ProductCard
              key={idx}
              product={product}
              isBestPrice={product.productUrl === lowestBasePriceId}
              isBestDeal={product.productUrl === lowestEffectiveId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  summary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  heading: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111'
  },
  cached: {
    padding: '6px 12px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '6px'
  },
  warning: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    borderRadius: '8px',
    marginBottom: '24px',
    fontSize: '14px'
  },
  empty: {
    padding: '48px',
    textAlign: 'center',
    color: '#666',
    fontSize: '16px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px'
  }
};
