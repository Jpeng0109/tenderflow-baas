export default function OperationsPanel({
  busy,
  selectedOrg,
  setSelectedOrg,
  selectedPeer,
  setSelectedPeer,
  decommissionTarget,
  setDecommissionTarget,
  onBootstrap,
  onStartCluster,
  onScaleUp,
  onDecommission,
  liquidityPeers,
}) {
  return (
    <aside className="cb-ops-panel">
      <h2>Operations Panel</h2>
      <p style={{ fontSize: '0.75rem', color: 'var(--cb-muted)', marginBottom: '1rem' }}>
        系统操作管理平台 — lifecycle & compliance controls
      </p>

      <button type="button" className="cb-btn cb-btn-primary" style={{ width: '100%', marginBottom: '0.5rem' }} disabled={busy} onClick={onBootstrap}>
        ⛓ Full Blockchain Bootstrap (3 steps)
      </button>
      <button type="button" className="cb-btn" style={{ width: '100%', marginBottom: '1rem' }} disabled={busy} onClick={onStartCluster}>
        ▶ Start 14-Node Cluster
      </button>

      <hr style={{ border: 'none', borderTop: '1px solid var(--cb-border)', margin: '1rem 0' }} />

      <h3 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Dynamic Scale-Up</h3>
      <div className="cb-field">
        <label htmlFor="org-select">Liquidity org</label>
        <select id="org-select" value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}>
          <option value="liquidity-bankA.com">liquidity-bankA.com (Bank A)</option>
          <option value="liquidity-bankB.com">liquidity-bankB.com (Bank B)</option>
        </select>
      </div>
      <div className="cb-field">
        <label htmlFor="peer-index">Peer index</label>
        <input
          id="peer-index"
          type="number"
          min="3"
          max="8"
          value={selectedPeer}
          onChange={(e) => setSelectedPeer(parseInt(e.target.value, 10))}
        />
      </div>
      <button type="button" className="cb-btn cb-btn-primary" style={{ width: '100%' }} disabled={busy} onClick={onScaleUp}>
        + Dynamically Add New Liquidity Peer Node
      </button>

      <hr style={{ border: 'none', borderTop: '1px solid var(--cb-border)', margin: '1rem 0' }} />

      <h3 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Decommission Node</h3>
      <div className="cb-field">
        <label htmlFor="decom-select">Target peer</label>
        <select
          id="decom-select"
          value={decommissionTarget}
          onChange={(e) => setDecommissionTarget(e.target.value)}
        >
          <option value="">— select peer —</option>
          {liquidityPeers.map((p) => (
            <option key={p.fqdn} value={p.fqdn}>{p.fqdn}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="cb-btn cb-btn-danger"
        style={{ width: '100%' }}
        disabled={busy || !decommissionTarget}
        onClick={() => onDecommission(decommissionTarget)}
      >
        Revoke & Spin Down
      </button>
    </aside>
  );
}
