import { useState } from 'react';
import SearchBar from './components/SearchBar';
import ResultsGrid from './components/ResultsGrid';
import { searchProducts } from './services/api';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('electronics');
  // location: { type: 'none'|'auto'|'pincode', lat?, lng?, city?, pincode? }
  const [location, setLocation] = useState({ type: 'none' });

  const handleSearch = async (query) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const pincode = location.type === 'pincode' && location.pincode?.length === 6
        ? location.pincode : null;
      const lat = location.type === 'auto' ? location.lat : null;
      const lng = location.type === 'auto' ? location.lng : null;
      const data = await searchProducts(query, category, pincode, lat, lng);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🛒 Price Comparison</h1>
        <p style={styles.subtitle}>Find the best deals across multiple e-commerce platforms</p>
      </header>

      <main style={styles.main}>
        <SearchBar
          onSearch={handleSearch}
          loading={loading}
          category={category}
          onCategoryChange={setCategory}
          location={location}
          onLocationChange={setLocation}
        />

        {loading && (
          <div style={styles.loading}>
            <div style={styles.spinner}></div>
            <p>Searching across platforms...</p>
          </div>
        )}

        {error && (
          <div style={styles.error}>
            ❌ {error}
          </div>
        )}

        <ResultsGrid results={results} />
      </main>

      <footer style={styles.footer}>
        <p>Built with React + Node.js + Playwright</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  header: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '32px 24px',
    textAlign: 'center'
  },
  title: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    margin: 0
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '48px 24px'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#666'
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #2563eb',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite'
  },
  error: {
    padding: '16px',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    borderRadius: '8px',
    marginBottom: '24px',
    textAlign: 'center'
  },
  footer: {
    textAlign: 'center',
    padding: '24px',
    color: '#999',
    fontSize: '14px'
  }
};
