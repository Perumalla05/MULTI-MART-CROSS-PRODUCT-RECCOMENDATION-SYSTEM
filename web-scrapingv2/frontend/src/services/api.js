const API_BASE = '/api';

export async function searchProducts(query, category = 'electronics', pincode = null, lat = null, lng = null) {
  let url = `${API_BASE}/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`;
  if (pincode) url += `&pincode=${encodeURIComponent(pincode)}`;
  if (lat != null && lng != null) url += `&lat=${lat}&lng=${lng}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Search failed');
  }

  return response.json();
}
