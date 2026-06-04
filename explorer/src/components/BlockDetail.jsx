import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EXPLORER_API as API } from '../lib/api.js';

export default function BlockDetail() {
  const { num } = useParams();
  const [block, setBlock] = useState(null);

  useEffect(() => {
    fetch(`${API}/blocks/${num}`)
      .then((r) => r.json())
      .then(setBlock)
      .catch(() => setBlock(null));
  }, [num]);

  return (
    <div>
      <header className="fx-header">
        <Link to="/" className="fx-logo" style={{ textDecoration: 'none' }}>
          ← FXBridgeScan
        </Link>
      </header>
      <main className="fx-container">
        <h1 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Block #{num}</h1>
        {block ? (
          <>
            <div className="fx-detail" style={{ marginBottom: '1rem' }}>
              <p><strong>Hash:</strong> <code>{block.hash}</code></p>
              <p><strong>Time:</strong> {block.time}</p>
              <p><strong>Transactions:</strong> {block.txCount}</p>
              <p><strong>Mined by:</strong> {block.minedBy}</p>
              <p><strong>Channel:</strong> {block.channelId}</p>
            </div>
            <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Transactions in block</h2>
            <div className="fx-panel">
              <div className="fx-tx-header">
                <span>Tx Hash</span>
                <span>From</span>
                <span>To</span>
                <span>Value</span>
                <span>Fee</span>
              </div>
              {(block.transactions || []).map((tx) => (
                <div key={tx.hash} className="fx-tx-row">
                  <Link className="fx-tx-hash" to={`/tx/${tx.hash}`}>{tx.hash.slice(0, 14)}…</Link>
                  <span>{tx.from}</span>
                  <span>{tx.to}</span>
                  <span className="fx-tx-value">{tx.value}</span>
                  <span className="fx-tx-fee">{tx.fee}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>Loading block…</p>
        )}
      </main>
    </div>
  );
}
