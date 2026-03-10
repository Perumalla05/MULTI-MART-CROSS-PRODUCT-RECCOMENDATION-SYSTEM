const VALID_CATEGORIES = ['electronics', 'grocery', 'fashion'];

export function validateSearchQuery(req, res, next) {
  const { q, category } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid query parameter',
      message: 'Query parameter "q" is required and must be a string'
    });
  }

  const trimmed = q.trim();

  if (trimmed.length < 2) {
    return res.status(400).json({
      error: 'Query too short',
      message: 'Query must be at least 2 characters long'
    });
  }

  if (trimmed.length > 200) {
    return res.status(400).json({
      error: 'Query too long',
      message: 'Query must not exceed 200 characters'
    });
  }

  const validatedCategory = category && VALID_CATEGORIES.includes(category)
    ? category
    : 'electronics';

  const { pincode, lat, lng } = req.query;
  const validatedPincode = pincode && /^\d{6}$/.test(pincode.trim()) ? pincode.trim() : null;

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const validatedLat = !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : null;
  const validatedLng = !isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : null;

  req.validatedQuery = trimmed;
  req.validatedCategory = validatedCategory;
  req.validatedPincode = validatedPincode;
  req.validatedLat = validatedLat;
  req.validatedLng = validatedLng;
  next();
}
