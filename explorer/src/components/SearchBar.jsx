import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EXPLORER_API as API } from '../lib/api.js';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      if (/^\d+$/.test(q)) {
        navigate(`/block/${q}`);
        return;
      }
      if (/^0x/i.test(q) || q.length >= 16) {
        navigate(`/tx/${q.startsWith('0x') ? q : `0x${q}`}`);
        return;
      }
      const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.type === 'transaction' && data.result?.hash) {
        navigate(`/tx/${data.result.hash}`);
      } else if (data.type === 'block' && data.result?.number != null) {
        navigate(`/block/${data.result.number}`);
      } else if (data.type === 'asset_pair' && data.results?.[0]) {
        navigate(`/tx/${data.results[0].hash}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="fx-search-form" onSubmit={handleSubmit}>
      <input
        className="fx-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by Tx Hash / Block # / Asset Pair (USD/EUR)"
        aria-label="Search"
      />
      <button type="submit" className="fx-search-btn" disabled={loading}>
        {loading ? '…' : 'Search'}
      </button>
    </form>
  );
}
