import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';

import { EXPLORER_API as API } from '../lib/api.js';

const DEMO_BLOCKS = Array.from({ length: 8 }, (_, i) => ({
  number: 12847 - i,
  elapsedSec: i * 2 + 1,
  txCount: 4 + (i % 5),
  minedBy: 'Provincial Transport Dept.',
}));

const DEMO_TXS = Array.from({ length: 12 }, (_, i) => ({
  hash: `0x${(12847 - i).toString(16).padStart(8, '0')}abcd${i.toString(16).padStart(48, '0')}`.slice(0, 66),
  from: ['Bidder-A', 'Bidder-B', 'Bidder-C', 'Bidder-D'][i % 4],
  to: 'tenderflow-cc/tenderflow-channel',
  value: ['BID_COMMIT', 'BID_REVEAL', 'REPUTATION_UPDATE', 'TENDER_CREATE'][i % 4],
  fee: `${(0.002 + i * 0.0003).toFixed(4)} GAS`,
}));

function elapsedLabel(sec) {
  if (sec < 60) return `${sec} secs ago`;
  return `${Math.floor(sec / 60)} mins ago`;
}

export default function EtherscanDashboard() {
  const [telemetry, setTelemetry] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [t, b, tx] = await Promise.all([
          fetch(`${API}/telemetry`).then((r) => r.json()),
          fetch(`${API}/blocks/latest?limit=8`).then((r) => r.json()),
          fetch(`${API}/transactions/latest?limit=12`).then((r) => r.json()),
        ]);
        setTelemetry(t);
        setBlocks(b.blocks?.length ? b.blocks : DEMO_BLOCKS);
        setTransactions(tx.transactions?.length ? tx.transactions : DEMO_TXS);
      } catch {
        setTelemetry({
          latestBlockHeight: 12847,
          totalQuotationTxs: 93421,
          activeNodesLabel: '0/14 Live',
          averageBlockTimeSec: 2.1,
          channelId: 'tenderflow-channel',
          dataSource: 'demo',
        });
        setBlocks(DEMO_BLOCKS);
        setTransactions(DEMO_TXS);
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const sourceLabel = telemetry?.dataSource === 'ledger'
    ? 'Live Ledger'
    : telemetry?.dataSource === 'peer-cli'
      ? 'Peer CLI'
      : telemetry?.dataSource === 'demo'
        ? 'Demo Feed'
        : 'Standby';

  return (
    <>
      <header className="fx-header">
        <div className="fx-logo">
          TENDERFLOWScan
          <span>tenderflow-channel · Ma'anshan Bridge · {sourceLabel}</span>
        </div>
        <SearchBar />
      </header>

      <main className="fx-container">
        <section className="fx-stats" aria-label="Network telemetry">
          <StatCard label="Latest Block Height" value={telemetry?.latestBlockHeight ?? '—'} loading={loading} />
          <StatCard label="Total Tender Txs" value={telemetry?.totalTenderTxs?.toLocaleString?.() ?? telemetry?.totalQuotationTxs?.toLocaleString?.() ?? '—'} loading={loading} />
          <StatCard label="Active Nodes Matrix" value={telemetry?.activeNodesLabel ?? '—'} loading={loading} />
          <StatCard label="Average Blk Time" value={telemetry ? `${telemetry.averageBlockTimeSec}s` : '—'} loading={loading} />
        </section>

        <section className="fx-split">
          <div className="fx-panel">
            <div className="fx-panel-header">
              <span>Latest Blocks</span>
            </div>
            <div className="fx-panel-body">
              {blocks.map((block) => (
                <Link key={block.number} to={`/block/${block.number}`} className="fx-block-card fx-block-link">
                  <div className="fx-block-num">#{block.number}</div>
                  <div>
                    <div className="fx-block-meta">{elapsedLabel(block.elapsedSec)}</div>
                    <div className="fx-block-meta">{block.txCount} txns in block</div>
                  </div>
                  <span className="fx-block-badge">Mined by {block.minedBy}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="fx-panel">
            <div className="fx-panel-header">
              <span>Latest Transactions</span>
            </div>
            <div className="fx-tx-header">
              <span>Tx Hash</span>
              <span>From</span>
              <span>To</span>
              <span>Value (Pair)</span>
              <span>Fee</span>
            </div>
            <div className="fx-panel-body" style={{ maxHeight: 440 }}>
              {transactions.map((tx) => (
                <div key={tx.hash} className="fx-tx-row">
                  <Link className="fx-tx-hash" to={`/tx/${encodeURIComponent(tx.hash)}`} title={tx.hash}>
                    {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
                  </Link>
                  <span className="fx-tx-from">{tx.from}</span>
                  <span className="fx-tx-from">{tx.to}</span>
                  <span className="fx-tx-value">{tx.value}</span>
                  <span className="fx-tx-fee">{tx.fee}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function StatCard({ label, value, loading }) {
  return (
    <div className="fx-stat-card">
      <div className="fx-stat-label">{label}</div>
      <div className="fx-stat-value">{loading ? '…' : value}</div>
    </div>
  );
}
