import { formatPrice, formatDiscount, getPlatformColor } from '../utils/format';

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

export default function ProductCard({ product, isBestPrice, isBestDeal }) {
  const cardStyle = {
    ...styles.card,
    ...(isBestPrice ? styles.highlightPrice : {}),
    ...(isBestDeal ? styles.highlightDeal : {}),
  };

  const bestOfferPrice = product.priceOptions && product.priceOptions.length > 0
    ? product.priceOptions[0].price
    : null;
  const showEffectivePrice = bestOfferPrice && bestOfferPrice < product.basePrice;

  return (
    <div style={cardStyle}>
      <div style={styles.header}>
        <span style={{...styles.platformBadge, backgroundColor: getPlatformColor(product.source)}}>
          {product.source}
        </span>
        <div style={styles.badges}>
          {isBestPrice && <span style={styles.bestPriceBadge}>BEST PRICE</span>}
          {isBestDeal && <span style={styles.bestDealBadge}>BEST DEAL</span>}
        </div>
      </div>

      <img src={product.imageUrl} alt={product.title} style={styles.image} />

      <h3 style={styles.title}>{product.title}</h3>

      {product.rating && (
        <div style={styles.ratingRow}>
          <span style={styles.stars}>{renderStars(product.rating)}</span>
          <span style={styles.ratingValue}>{product.rating.toFixed(1)}</span>
          {product.ratingCount && (
            <span style={styles.ratingCount}>({product.ratingCount.toLocaleString()})</span>
          )}
        </div>
      )}

      <div style={styles.priceSection}>
        <div style={styles.mainPrice}>{formatPrice(product.basePrice)}</div>
        {product.mrp && product.mrp > product.basePrice && (
          <div style={styles.mrp}>{formatPrice(product.mrp)}</div>
        )}
        {product.discountPercent && (
          <div style={styles.discount}>{formatDiscount(product.discountPercent)}</div>
        )}
      </div>

      {product.deliveryTime && (
        <div style={styles.deliveryBadge}>
          🕐 {product.deliveryTime} delivery
        </div>
      )}

      {showEffectivePrice && (
        <div style={styles.effectivePrice}>
          Best with offers: {formatPrice(bestOfferPrice)}
          <span style={styles.effectiveSavings}> (Save {formatPrice(product.basePrice - bestOfferPrice)})</span>
        </div>
      )}

      {product.rawOffers && product.rawOffers.length > 0 && (
        <div style={styles.offers}>
          <div style={styles.offersTitle}>💰 Offers Available</div>
          {product.rawOffers.slice(0, 5).map((offer, idx) => (
            <div key={idx} style={styles.offer}>• {offer}</div>
          ))}
          {product.rawOffers.length > 5 && (
            <div style={styles.moreOffers}>+{product.rawOffers.length - 5} more offers</div>
          )}
        </div>
      )}

      {product.priceOptions && product.priceOptions.length > 1 && (
        <div style={styles.priceOptions}>
          <div style={styles.priceOptionsTitle}>💵 Price Options:</div>
          {product.priceOptions.map((option, idx) => (
            <div key={idx} style={styles.priceOption}>
              <div style={styles.optionScenario}>{option.scenario}</div>
              <div style={styles.optionPrice}>
                {formatPrice(option.price)}
                {option.savings > 0 && (
                  <span style={styles.optionSavings}> (Save {formatPrice(option.savings)})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <a href={product.productUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
        View Product →
      </a>
    </div>
  );
}

const styles = {
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    backgroundColor: 'white',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  highlightPrice: {
    border: '2px solid #2563eb',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
  },
  highlightDeal: {
    border: '2px solid #10b981',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  platformBadge: {
    padding: '4px 12px',
    borderRadius: '6px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600'
  },
  badges: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  bestPriceBadge: {
    padding: '4px 8px',
    backgroundColor: '#2563eb',
    color: 'white',
    fontSize: '11px',
    fontWeight: '700',
    borderRadius: '4px'
  },
  bestDealBadge: {
    padding: '4px 8px',
    backgroundColor: '#10b981',
    color: 'white',
    fontSize: '11px',
    fontWeight: '700',
    borderRadius: '4px'
  },
  image: {
    width: '100%',
    height: '200px',
    objectFit: 'contain',
    marginBottom: '12px'
  },
  title: {
    fontSize: '14px',
    lineHeight: '1.4',
    marginBottom: '12px',
    height: '40px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '8px'
  },
  stars: {
    color: '#f59e0b',
    fontSize: '14px',
    letterSpacing: '1px'
  },
  ratingValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151'
  },
  ratingCount: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  priceSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  mainPrice: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111'
  },
  mrp: {
    fontSize: '14px',
    color: '#999',
    textDecoration: 'line-through'
  },
  discount: {
    fontSize: '12px',
    color: '#10b981',
    fontWeight: '600'
  },
  effectivePrice: {
    fontSize: '13px',
    color: '#059669',
    fontWeight: '600',
    marginBottom: '10px'
  },
  effectiveSavings: {
    fontSize: '12px',
    color: '#10b981',
    fontWeight: '500'
  },
  offers: {
    backgroundColor: '#fef3c7',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '10px',
    fontSize: '12px'
  },
  offersTitle: {
    fontWeight: '600',
    color: '#92400e',
    marginBottom: '6px'
  },
  offer: {
    color: '#78350f',
    lineHeight: '1.5',
    marginTop: '4px',
    wordWrap: 'break-word',
    overflowWrap: 'break-word'
  },
  moreOffers: {
    fontSize: '11px',
    color: '#92400e',
    fontWeight: '600',
    marginTop: '6px',
    fontStyle: 'italic'
  },
  priceOptions: {
    backgroundColor: '#d1fae5',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '10px',
    fontSize: '12px'
  },
  priceOptionsTitle: {
    fontWeight: '600',
    color: '#065f46',
    marginBottom: '8px'
  },
  priceOption: {
    padding: '6px 0',
    borderBottom: '1px solid #a7f3d0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  optionScenario: {
    color: '#047857',
    fontSize: '11px',
    fontWeight: '500'
  },
  optionPrice: {
    color: '#059669',
    fontSize: '13px',
    fontWeight: '700'
  },
  optionSavings: {
    fontSize: '10px',
    color: '#10b981',
    fontWeight: '500'
  },
  deliveryBadge: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    border: '1px solid #86efac',
    borderRadius: '4px',
    padding: '3px 8px',
    marginBottom: '8px'
  },
  link: {
    display: 'inline-block',
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600'
  }
};
