export function formatPrice(price) {
  return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDiscount(percent) {
  return percent ? `${percent}% OFF` : 'N/A';
}

export function getPlatformColor(platform) {
  const colors = {
    Amazon: '#FF9900',
    'Amazon Fresh': '#4CAF50',
    'Amazon Fashion': '#E91E8C',
    Flipkart: '#2874F0',
    'Flipkart Minutes': '#00B9F1',
    'Flipkart Fashion': '#9C27B0',
    Croma: '#00A699',
    'Reliance Digital': '#0072BC',
    'Tata CLiQ': '#D32F2F',
    Myntra: '#FF3F6C',
    Ajio: '#C8A882',
    'Swiggy Instamart': '#FC8019',
    Zepto: '#8B2FC9',
    Nykaa: '#FC2779',
    Meesho: '#6B1B5E'
  };
  return colors[platform] || '#666';
}
