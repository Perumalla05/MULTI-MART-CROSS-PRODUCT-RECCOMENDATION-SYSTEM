import { useState } from 'react';

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics', icon: '📱' },
  { value: 'grocery', label: 'Grocery', icon: '🛒' },
  { value: 'fashion', label: 'Fashion', icon: '👗' }
];

// Reverse-geocode lat/lng → human-readable city using OpenStreetMap Nominatim (free, no key)
async function reverseGeocode(lat, lng) {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const a = data.address || {};
    return a.city || a.town || a.suburb || a.county || a.state || null;
  } catch {
    return null;
  }
}

export default function SearchBar({ onSearch, loading, category, onCategoryChange, location, onLocationChange }) {
  const [query, setQuery] = useState('');
  const [detectState, setDetectState] = useState('idle'); // idle | detecting | done | error
  const [showPincodeInput, setShowPincodeInput] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setDetectState('error');
      onLocationChange({ type: 'none' });
      return;
    }
    setDetectState('detecting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const city = await reverseGeocode(lat, lng);
        setDetectState('done');
        onLocationChange({ type: 'auto', lat, lng, city: city || 'Your location' });
        setShowPincodeInput(false);
      },
      () => {
        setDetectState('error');
        onLocationChange({ type: 'none' });
      },
      { timeout: 8000 }
    );
  };

  const handlePincodeChange = (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    onLocationChange({ type: 'pincode', pincode: clean });
  };

  const handleClearLocation = () => {
    setDetectState('idle');
    setShowPincodeInput(false);
    onLocationChange({ type: 'none' });
  };

  const placeholder =
    category === 'grocery' ? 'Search for grocery items (e.g., Amul Butter, Basmati Rice)' :
    category === 'fashion' ? 'Search for fashion items (e.g., Blue Jeans, Floral Dress, Sneakers)' :
    'Search for products (e.g., iPhone 15, Samsung TV)';

  const isAutoDetected = location?.type === 'auto';
  const pincode = location?.type === 'pincode' ? location.pincode : '';

  return (
    <div style={styles.wrapper}>
      <div style={styles.categoryRow}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            type="button"
            disabled={loading}
            onClick={() => onCategoryChange(cat.value)}
            style={{
              ...styles.categoryBtn,
              ...(category === cat.value ? styles.categoryBtnActive : {})
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {category === 'grocery' && (
        <div style={styles.locationBox}>
          <div style={styles.locationHeader}>
            <span style={styles.locationLabel}>📍 Delivery Location</span>
            {(isAutoDetected || pincode) && (
              <button type="button" onClick={handleClearLocation} style={styles.clearBtn}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Auto-detect row */}
          <div style={styles.locationRow}>
            {isAutoDetected ? (
              <div style={styles.detectedChip}>
                <span style={styles.detectedDot} />
                <span style={styles.detectedCity}>{location.city}</span>
                <span style={styles.detectedSub}>(GPS auto-detected)</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={loading || detectState === 'detecting'}
                style={{
                  ...styles.detectBtn,
                  ...(detectState === 'detecting' ? styles.detectBtnDisabled : {})
                }}
              >
                {detectState === 'detecting' ? '⏳ Detecting...' :
                 detectState === 'error'     ? '⚠️ Try again' :
                                              '🎯 Detect my location'}
              </button>
            )}

            <span style={styles.orDivider}>or</span>

            {/* Pincode toggle / input */}
            {showPincodeInput || pincode ? (
              <div style={styles.pincodeInline}>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="6-digit pincode"
                  disabled={loading}
                  maxLength={6}
                  style={{
                    ...styles.pincodeInput,
                    ...(isAutoDetected ? styles.pincodeInputDisabled : {})
                  }}
                />
                {pincode && pincode.length !== 6 && (
                  <span style={styles.pincodeHint}>Must be 6 digits</span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setShowPincodeInput(true); setDetectState('idle'); onLocationChange({ type: 'pincode', pincode: '' }); }}
                disabled={loading || isAutoDetected}
                style={{
                  ...styles.pincodeToggleBtn,
                  ...(isAutoDetected ? styles.pincodeToggleBtnDisabled : {})
                }}
              >
                Enter pincode
              </button>
            )}
          </div>

          {!isAutoDetected && !pincode && detectState === 'idle' && (
            <div style={styles.locationHint}>
              Auto-detect or enter pincode for Zepto &amp; Instamart results
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          style={styles.input}
        />
        <button type="submit" disabled={loading || !query.trim()} style={styles.button}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrapper: { marginBottom: '32px' },
  categoryRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  categoryBtn: {
    padding: '8px 20px', fontSize: '14px', fontWeight: '500',
    backgroundColor: 'white', color: '#374151', border: '2px solid #e5e7eb',
    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s'
  },
  categoryBtnActive: { backgroundColor: '#2563eb', color: 'white', borderColor: '#2563eb' },

  locationBox: {
    marginBottom: '12px', padding: '12px 14px',
    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px'
  },
  locationHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  locationLabel: { fontSize: '13px', fontWeight: '600', color: '#166534' },
  clearBtn: {
    fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none',
    cursor: 'pointer', padding: '2px 6px'
  },
  locationRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },

  detectBtn: {
    padding: '8px 16px', fontSize: '13px', fontWeight: '600',
    backgroundColor: '#2563eb', color: 'white', border: 'none',
    borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap'
  },
  detectBtnDisabled: { backgroundColor: '#93c5fd', cursor: 'not-allowed' },

  detectedChip: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', backgroundColor: '#dcfce7', border: '1px solid #86efac',
    borderRadius: '6px'
  },
  detectedDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    backgroundColor: '#16a34a', flexShrink: 0
  },
  detectedCity: { fontSize: '13px', fontWeight: '600', color: '#15803d' },
  detectedSub: { fontSize: '11px', color: '#6b7280', fontStyle: 'italic' },

  orDivider: { fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' },

  pincodeToggleBtn: {
    padding: '8px 14px', fontSize: '13px', fontWeight: '500',
    backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db',
    borderRadius: '6px', cursor: 'pointer'
  },
  pincodeToggleBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },

  pincodeInline: { display: 'flex', alignItems: 'center', gap: '8px' },
  pincodeInput: {
    padding: '8px 12px', fontSize: '14px', border: '1px solid #86efac',
    borderRadius: '6px', outline: 'none', width: '140px', letterSpacing: '2px'
  },
  pincodeInputDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  pincodeHint: { fontSize: '12px', color: '#6b7280', fontStyle: 'italic' },

  locationHint: { marginTop: '6px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' },

  form: { display: 'flex', gap: '12px' },
  input: {
    flex: 1, padding: '14px 18px', fontSize: '16px',
    border: '2px solid #ddd', borderRadius: '8px', outline: 'none'
  },
  button: {
    padding: '14px 32px', fontSize: '16px', fontWeight: '600',
    backgroundColor: '#2563eb', color: 'white', border: 'none',
    borderRadius: '8px', cursor: 'pointer'
  }
};
