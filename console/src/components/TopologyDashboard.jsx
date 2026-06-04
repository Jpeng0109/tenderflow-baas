import { useCallback, useEffect, useState } from 'react';
import TopologyMap from './TopologyMap';
import OperationsPanel from './OperationsPanel';
import { API } from '../lib/api.js';

export default function TopologyDashboard() {
  const [topology, setTopology] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('liquidity-bankA.com');
  const [selectedPeer, setSelectedPeer] = useState(3);
  const [decommissionTarget, setDecommissionTarget] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/topology`);
      setTopology(await res.json());
    } catch {
      setTopology(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function runAction(label, fn) {
    setBusy(true);
    setMessage(label);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  const liquidityPeers = (topology?.peers || []).filter(
    (p) => p.org?.startsWith('liquidity'),
  );

  const liveCount = topology?.liveCount ?? 0;
  const isLive = liveCount >= 10;

  return (
    <div className="cb-app">
      <header className="cb-header">
        <div>
          <h1 className="cb-title">TENDERFLOW Console</h1>
          <p className="cb-subtitle">
            马鞍山长江大桥招标实验 · Channel {topology?.channelId || 'tenderflow-channel'}
          </p>
        </div>
        <div className={`cb-status-pill`}>
          <span className={`cb-status-dot ${isLive ? '' : 'offline'}`} />
          {liveCount}/{topology?.infrastructureNodeCount ?? 14} nodes live
        </div>
      </header>

      {message && <div className="cb-alert">{message}</div>}

      <div className="cb-layout">
        <section className="cb-map-panel">
          <TopologyMap topology={topology} />
        </section>
        <OperationsPanel
          busy={busy}
          selectedOrg={selectedOrg}
          setSelectedOrg={setSelectedOrg}
          selectedPeer={selectedPeer}
          setSelectedPeer={setSelectedPeer}
          decommissionTarget={decommissionTarget}
          setDecommissionTarget={setDecommissionTarget}
          liquidityPeers={liquidityPeers}
          onBootstrap={() => runAction('Running full blockchain bootstrap (crypto → compose → channel → chaincode)…', async () => {
            const res = await fetch(`${API}/nodes/bootstrap`, { method: 'POST' });
            const data = await res.json();
            setMessage(data.ok ? 'Bootstrap complete.' : `Bootstrap: ${JSON.stringify(data.results)}`);
          })}
          onStartCluster={() => runAction('Starting 14-node Fabric cluster…', async () => {
            const res = await fetch(`${API}/nodes/cluster/start`, { method: 'POST' });
            const data = await res.json();
            setMessage(data.ok ? 'Cluster start initiated.' : data.error);
          })}
          onScaleUp={() => runAction(`Provisioning peer${selectedPeer}.${selectedOrg}…`, async () => {
            const res = await fetch(`${API}/nodes/peer/scale-up`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orgDomain: selectedOrg, peerIndex: selectedPeer }),
            });
            const data = await res.json();
            setMessage(data.ok ? `Scaled up ${data.fqdn}` : data.error);
          })}
          onDecommission={(fqdn) => {
            if (!window.confirm(`Decommission ${fqdn}? Certificates will be revoked.`)) return;
            runAction(`Decommissioning ${fqdn}…`, async () => {
              const res = await fetch(`${API}/nodes/peer/decommission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fqdn }),
              });
              const data = await res.json();
              setMessage(data.ok ? `${fqdn} decommissioned` : data.error);
              setDecommissionTarget('');
            });
          }}
        />
      </div>
    </div>
  );
}
