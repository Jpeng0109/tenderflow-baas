import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { EXPLORER_API as API } from '../lib/api.js';

export default function TransactionDetail() {
  const { hash } = useParams();
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetch(`${API}/transactions/${encodeURIComponent(hash)}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [hash]);

  const payload = detail?.rwSetInspector;

  return (
    <div>
      <header className="fx-header">
        <Link to="/" className="fx-logo" style={{ textDecoration: 'none' }}>
          ← TENDERFLOWScan
        </Link>
      </header>
      <main className="fx-container">
        <h1 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Transaction Details</h1>
        <p style={{ fontFamily: 'var(--fx-mono)', fontSize: '0.85rem', color: 'var(--fx-muted)', marginBottom: '1rem' }}>
          {hash}
        </p>

        <section className="fx-detail">
          <h2 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Read/Write Set Inspector — Tender Payload</h2>
          {payload ? (
            <pre className="fx-json">{JSON.stringify(payload, null, 2)}</pre>
          ) : (
            <p>Loading transaction ledger changes…</p>
          )}

          {detail?.readSet && (
            <>
              <h3 style={{ marginTop: '1.25rem', fontSize: '0.85rem' }}>Read Set</h3>
              <pre className="fx-json" style={{ marginTop: '0.5rem' }}>
                {JSON.stringify(detail.readSet, null, 2)}
              </pre>
            </>
          )}
          {detail?.writeSet && (
            <>
              <h3 style={{ marginTop: '1rem', fontSize: '0.85rem' }}>Write Set</h3>
              <pre className="fx-json" style={{ marginTop: '0.5rem' }}>
                {JSON.stringify(detail.writeSet, null, 2)}
              </pre>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
