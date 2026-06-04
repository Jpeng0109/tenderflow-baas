import { Router } from 'express';
import {
  startFabricCluster,
  spawnDynamicPeer,
  decommissionPeer,
  stopPeerServices,
  getDynamicPeers,
} from '../controllers/dockerOrchestrator.js';
import { provisionDynamicPeerCrypto } from '../controllers/cryptoProvisioner.js';
import { joinPeerToChannel } from '../controllers/channelJoiner.js';
import { PEER_ORGS, peerFqdn } from '../config/topology.js';
import { logger } from '../utils/logger.js';
import { runFullBootstrap } from '../controllers/networkBootstrap.js';

const router = Router();

/** POST /api/nodes/bootstrap — full 3-step blockchain layer from UI */
router.post('/bootstrap', async (_req, res) => {
  try {
    const result = await runFullBootstrap();
    res.status(result.ok ? 200 : 500).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** POST /api/nodes/cluster/start — docker compose up -d (14-node cluster) */
router.post('/cluster/start', async (req, res) => {
  try {
    const result = await startFabricCluster(req.body.services || []);
    res.json({ ok: true, message: 'Fabric cluster starting', ...result });
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({ ok: false, error: err.message, stderr: err.stderr });
  }
});

/** POST /api/nodes/peer/scale-up — dynamic liquidity peer */
router.post('/peer/scale-up', async (req, res) => {
  const orgDomain = req.body.orgDomain || 'liquidity-bankA.com';
  const peerIndex = req.body.peerIndex ?? 3;

  try {
    const crypto = await provisionDynamicPeerCrypto({ orgDomain, peerIndex });
    const container = await spawnDynamicPeer({ orgDomain, peerIndex });
    const join = await joinPeerToChannel(peerFqdn(orgDomain, peerIndex));

    res.status(201).json({
      ok: true,
      fqdn: peerFqdn(orgDomain, peerIndex),
      crypto,
      container,
      channelJoin: join,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, stderr: err.stderr });
  }
});

/** POST /api/nodes/peer/decommission */
router.post('/peer/decommission', async (req, res) => {
  const { fqdn } = req.body;
  if (!fqdn) return res.status(400).json({ ok: false, error: 'fqdn required' });

  try {
    const result = await decommissionPeer(fqdn);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** DELETE /api/nodes/peer/:fqdn — compose-managed peer stop */
router.delete('/peer/:fqdn', async (req, res) => {
  try {
    await stopPeerServices(req.params.fqdn);
    res.json({ ok: true, fqdn: req.params.fqdn, status: 'stopped' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** GET /api/nodes/dynamic */
router.get('/dynamic', (_req, res) => {
  res.json({ peers: getDynamicPeers(), orgs: PEER_ORGS });
});

export default router;
