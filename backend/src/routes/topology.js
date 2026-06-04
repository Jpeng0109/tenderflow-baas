import { Router } from 'express';
import {
  BASE_PEERS,
  ORDERER_NODES,
  INFRASTRUCTURE_NODE_COUNT,
  CHANNEL_ID,
  PEER_ORGS,
} from '../config/topology.js';
import { inspectNodeHealth, getDynamicPeers } from '../controllers/dockerOrchestrator.js';

const router = Router();

/** GET /api/topology — interactive map data */
router.get('/', async (_req, res) => {
  let health = { nodes: [], liveCount: 0 };
  try {
    health = await inspectNodeHealth();
  } catch {
    /* docker unavailable — return static topology for UI dev */
  }

  const orderers = ORDERER_NODES.map((o) => ({
    ...o,
    type: 'orderer',
    org: 'clearing-raft.org',
    status: health.nodes.find((n) => n.name === o.fqdn)?.status || 'unknown',
    live: health.nodes.find((n) => n.name === o.fqdn)?.live ?? false,
  }));

  const peers = BASE_PEERS.map((p) => ({
    ...p,
    type: 'peer',
    orgDisplay: PEER_ORGS[p.org]?.displayName,
    status: health.nodes.find((n) => n.name === p.fqdn)?.status || 'unknown',
    live: health.nodes.find((n) => n.name === p.fqdn)?.live ?? false,
  }));

  const dynamic = getDynamicPeers().map((p) => ({
    ...p,
    type: 'peer',
    dynamic: true,
    status: health.nodes.find((n) => n.name === p.fqdn)?.status || 'unknown',
    live: health.nodes.find((n) => n.name === p.fqdn)?.live ?? false,
  }));

  res.json({
    channelId: CHANNEL_ID,
    infrastructureNodeCount: INFRASTRUCTURE_NODE_COUNT,
    liveCount: health.liveCount,
    orderers,
    peers: [...peers, ...dynamic],
    orgs: PEER_ORGS,
  });
});

export default router;
