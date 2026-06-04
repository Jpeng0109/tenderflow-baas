/**
 * Interactive SVG topology — 5 RAFT orderers + 3 org peer zones (14 base nodes)
 */
export default function TopologyMap({ topology }) {
  const orderers = topology?.orderers || [];
  const peers = topology?.peers || [];
  const live = topology?.liveCount ?? 0;
  const total = topology?.infrastructureNodeCount ?? 14;

  const bankAPeers = peers.filter((p) => p.org === 'liquidity-bankA.com');
  const bankBPeers = peers.filter((p) => p.org === 'liquidity-bankB.com');
  const regPeers = peers.filter((p) => p.org === 'centralbank.gov');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Interactive Topology Map</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--cb-muted)' }}>
          {live}/{total} nodes active
        </span>
      </div>
      <svg viewBox="0 0 720 380" width="100%" style={{ maxHeight: 360 }} aria-label="Network topology">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#475569" />
          </marker>
        </defs>

        {/* RAFT cluster */}
        <rect x="240" y="12" width="240" height="72" rx="8" fill="#1e1b4b" stroke="#8b5cf6" strokeWidth="1.5" />
        <text x="360" y="32" textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="600">
          RAFT · clearing-raft.org
        </text>
        {orderers.map((o, i) => (
          <g key={o.fqdn}>
            <circle
              cx={270 + i * 40}
              cy={58}
              r="10"
              fill={o.live ? '#10b981' : '#475569'}
              stroke="#fff"
              strokeWidth="1"
            />
            <text x={270 + i * 40} y="78" textAnchor="middle" fill="#94a3b8" fontSize="7">
              {o.id?.replace('orderer', 'o') || i + 1}
            </text>
          </g>
        ))}

        {/* Regulatory org */}
        <OrgZone x={24} y={110} w={200} h={120} label="Regulator Org" sub="Prov. Transport Dept." color="#eab308" />
        {regPeers.slice(0, 3).map((p, i) => (
          <PeerDot key={p.fqdn} x={74 + i * 50} y={175} live={p.live} label={`p${i}`} />
        ))}

        {/* Bank A */}
        <OrgZone x={260} y={110} w={200} h={120} label="Constructor Org" sub="Tier-1 Bidders" color="#06b6d4" />
        {bankAPeers.slice(0, 4).map((p, i) => (
          <PeerDot key={p.fqdn} x={310 + i * 45} y={175} live={p.live} label={`p${p.index ?? i}`} />
        ))}

        {/* Bank B */}
        <OrgZone x={496} y={110} w={200} h={120} label="Audit/Finance Org" sub="Auditors & Banks" color="#ec4899" />
        {bankBPeers.slice(0, 3).map((p, i) => (
          <PeerDot key={p.fqdn} x={546 + i * 50} y={175} live={p.live} label={`p${i}`} />
        ))}

        {/* Channel */}
        <rect x="120" y="260" width="480" height="44" rx="8" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="1" />
        <text x="360" y="286" textAnchor="middle" fill="#7dd3fc" fontSize="12" fontWeight="600">
          fx-bridge-channel · CouchDB State
        </text>

        {/* Links orderers → channel */}
        {orderers.map((_, i) => (
          <line
            key={`link-${i}`}
            x1={270 + i * 40}
            y1={68}
            x2={200 + i * 80}
            y2={260}
            stroke="#475569"
            strokeWidth="1"
            markerEnd="url(#arrow)"
            opacity="0.5"
          />
        ))}
      </svg>

      <div className="cb-node-grid">
        {[...orderers, ...peers].map((n) => (
          <div key={n.fqdn || n.id} className={`cb-node-card ${n.live ? 'live' : ''}`}>
            <div className="name">{n.fqdn || n.id}</div>
            <div className="meta">{n.type} · {n.status || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgZone({ x, y, w, h, label, sub, color }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" fill="#1a2332" stroke={color} strokeWidth="1.2" opacity="0.9" />
      <text x={x + w / 2} y={y + 22} textAnchor="middle" fill={color} fontSize="10" fontWeight="600">
        {label}
      </text>
      <text x={x + w / 2} y={y + 36} textAnchor="middle" fill="#64748b" fontSize="8">
        {sub}
      </text>
    </g>
  );
}

function PeerDot({ x, y, live, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r="12" fill={live ? '#10b981' : '#475569'} stroke="#f8fafc" strokeWidth="1" />
      <text x={x} y={y + 22} textAnchor="middle" fill="#94a3b8" fontSize="8">
        {label}
      </text>
    </g>
  );
}
