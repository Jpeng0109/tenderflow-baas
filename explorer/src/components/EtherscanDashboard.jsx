import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';

import { EXPLORER_API as API } from '../lib/api.js';

function elapsedLabel(sec) {
  if (sec < 60) return `${sec} secs ago`;
  return `${Math.floor(sec / 60)} mins ago`;
}

export default function EtherscanDashboard() {
  const [telemetry, setTelemetry] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [t, b, tx, n] = await Promise.all([
          fetch(`${API}/telemetry`).then((r) => r.json()),
          fetch(`${API}/blocks/latest?limit=12`).then((r) => r.json()),
          fetch(`${API}/transactions/latest?limit=40`).then((r) => r.json()),
          fetch(`${API}/nodes/sync`).then((r) => r.json()),
        ]);
        setTelemetry(t);
        setBlocks(b.blocks || []);
        setTransactions(tx.transactions || []);
        setNodes(n.nodes || []);
      } catch {
        setTelemetry(null);
        setBlocks([]);
        setTransactions([]);
        setNodes([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const sourceLabel = telemetry?.dataSource === 'mainnet_experiment'
    ? '14-Node Mainnet Sync'
    : telemetry?.dataSource === 'ledger'
      ? 'Live Ledger'
      : telemetry?.dataSource === 'peer-cli'
        ? 'Peer CLI'
        : telemetry?.dataSource === 'demo'
          ? 'Demo Feed'
          : 'Standby';

  const channel = telemetry?.channelId || 'fx-bridge-channel';

  return (
    <>
      <header className="fx-header">
        <div className="fx-logo">
          TENDERFLOWScan
          <span>{channel} · Ma&apos;anshan Bridge · {sourceLabel}</span>
        </div>
        <SearchBar />
      </header>

      <main className="fx-container">
        {telemetry?.syncSummary && (
          <div className="fx-sync-banner">
            <strong>Chain synced</strong>
            <span>{telemetry.syncSummary}</span>
            {telemetry.successfulTxs != null && (
              <span>{telemetry.successfulTxs} OK · {telemetry.failedTxs ?? 0} failed</span>
            )}
          </div>
        )}

        <section className="fx-stats" aria-label="Network telemetry">
          <StatCard label="Latest Block Height" value={telemetry?.latestBlockHeight ?? '—'} loading={loading} />
          <StatCard label="On-Chain Tender Txs" value={telemetry?.totalTenderTxs ?? '—'} loading={loading} />
          <StatCard label="Active Nodes Matrix" value={telemetry?.activeNodesLabel ?? '—'} loading={loading} />
          <StatCard label="Average Blk Time" value={telemetry ? `${telemetry.averageBlockTimeSec}s` : '—'} loading={loading} />
        </section>

        {nodes.length > 0 && (
          <section className="fx-panel fx-nodes-panel">
            <div className="fx-panel-header">
              <span>14 Infrastructure Nodes — Synced on {channel}</span>
            </div>
            <div className="fx-nodes-grid">
              {nodes.map((node) => (
                <div key={node.fqdn} className={`fx-node-chip ${node.type}`}>
                  <span className="fx-node-type">{node.type}</span>
                  <span className="fx-node-fqdn">{node.fqdn}</span>
                  <span className="fx-node-status">{node.synced ? 'synced' : node.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="fx-split">
          <div className="fx-panel">
            <div className="fx-panel-header">
              <span>Latest Blocks (height {telemetry?.latestBlockHeight ?? '—'})</span>
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
              <span>All Tender Transactions ({transactions.length})</span>
            </div>
            <div className="fx-tx-header">
              <span>Tx Hash</span>
              <span>From</span>
              <span>Block</span>
              <span>Type</span>
              <span>Status</span>
            </div>
            <div className="fx-panel-body fx-tx-scroll">
              {transactions.map((tx) => (
                <div key={tx.hash} className="fx-tx-row">
                  <Link className="fx-tx-hash" to={`/tx/${encodeURIComponent(tx.hash)}`} title={tx.hash}>
                    {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
                  </Link>
                  <span className="fx-tx-from">{tx.from}</span>
                  <span className="fx-tx-from">#{tx.blockNumber}</span>
                  <span className="fx-tx-value">{tx.value}</span>
                  <span className={`fx-tx-status ${tx.status?.toLowerCase()}`}>{tx.status}</span>
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
