import { v4 as uuidv4 } from 'uuid';
import {
  ORDERER_NODES,
  INFRASTRUCTURE_NODE_COUNT,
  CHANNEL_ID,
  PROJECT_NAME,
  TENDER_ID,
  SIMULATION_BIDDERS,
} from '../config/topology.js';
import { inspectNodeHealth } from '../controllers/dockerOrchestrator.js';
import { getChannelBlockHeight } from '../controllers/channelJoiner.js';
import { logger } from '../utils/logger.js';
import {
  getExperimentTelemetry,
  getExperimentBlocks,
  getExperimentTransactions,
  getExperimentNodes,
  isExperimentSnapshotAvailable,
} from './experimentSnapshotService.js';
import {
  isLedgerAvailable,
  getLedgerBlockHeight,
  getLatestBlocks as getLedgerBlocks,
  getLatestTransactions as getLedgerTxs,
  getTransactionFromLedger,
} from './fabricLedgerService.js';

const BIDDERS = SIMULATION_BIDDERS.map((b) => b.id);
const TX_TYPES = ['BID_COMMIT', 'BID_REVEAL', 'REPUTATION_UPDATE', 'TENDER_CREATE'];

let mockBlockHeight = 23;
let mockTenderTxCount = 35;
let ledgerMode = false;

export function buildTenderPayload(overrides = {}) {
  const txType = overrides.tx_type || TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)];
  const bidder = overrides.bidder_id || BIDDERS[Math.floor(Math.random() * BIDDERS.length)];
  const base = {
    tx_type: txType,
    tender_id: TENDER_ID,
    project_name: PROJECT_NAME,
    bidder_id: bidder,
    timestamp: new Date().toISOString(),
  };
  if (txType === 'BID_COMMIT') {
    return {
      ...base,
      bid_hash: overrides.bid_hash || `sha256:${uuidv4().replace(/-/g, '')}`,
      commit_phase: 'SEALED',
      zkPass_status: 'VERIFIED',
    };
  }
  if (txType === 'BID_REVEAL') {
    return {
      ...base,
      file_cid: overrides.file_cid || `ipfs://Qm${uuidv4().replace(/-/g, '').slice(0, 44)}`,
      integrity_status: overrides.integrity_status || 'VERIFIED_SUCCESS',
    };
  }
  if (txType === 'REPUTATION_UPDATE') {
    return {
      ...base,
      verified_reputation: overrides.verified_reputation ?? 0.85,
      behavioral_reputation: overrides.behavioral_reputation ?? 0.72,
      outcome: overrides.outcome || 'Success',
      total_score: overrides.total_score ?? 0.81,
    };
  }
  return {
    ...base,
    rfp_cid: overrides.rfp_cid || `ipfs://QmRFP${uuidv4().replace(/-/g, '').slice(0, 40)}`,
    bid_bond_pct: 2.0,
    status: 'Bidding',
  };
}

export function buildFxPayload(overrides = {}) {
  return buildTenderPayload(overrides);
}

function generateMockBlocks(count = 8) {
  const blocks = [];
  for (let i = 0; i < count; i += 1) {
    const num = mockBlockHeight - i;
    blocks.push({
      number: num,
      hash: `0x${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '').slice(0, 8)}`,
      time: new Date(Date.now() - i * 2100).toISOString(),
      elapsedSec: i * 2 + 1,
      txCount: 3 + Math.floor(Math.random() * 12),
      minedBy: 'Provincial Transport Dept.',
      channelId: CHANNEL_ID,
      source: 'mock',
    });
  }
  return blocks;
}

function generateMockTransactions(count = 12) {
  const txs = [];
  for (let i = 0; i < count; i += 1) {
    const payload = buildTenderPayload();
    txs.push({
      hash: `0x${uuidv4().replace(/-/g, '')}`,
      blockNumber: mockBlockHeight - Math.floor(i / 2),
      from: payload.bidder_id,
      to: `tenderflow-cc/${CHANNEL_ID}`,
      value: payload.tx_type,
      fee: `${(0.001 + Math.random() * 0.008).toFixed(4)} GAS`,
      status: 'SUCCESS',
      payload,
      timestamp: new Date(Date.now() - i * 1500).toISOString(),
      source: 'mock',
    });
    mockTenderTxCount += 1;
  }
  return txs;
}

async function ensureLedgerMode() {
  if (process.env.CLOUD_DEMO_MODE === 'true') return false;
  if (ledgerMode) return true;
  const ok = await isLedgerAvailable();
  ledgerMode = ok;
  return ok;
}

function useCloudSnapshot() {
  return process.env.CLOUD_DEMO_MODE === 'true' && isExperimentSnapshotAvailable();
}

export async function getDashboardTelemetry() {
  if (useCloudSnapshot()) {
    const expSnap = getExperimentTelemetry();
    if (expSnap) return expSnap;
  }

  let liveNodes = 0;
  try {
    const health = await inspectNodeHealth();
    liveNodes = health.liveCount;
  } catch {
    liveNodes = 0;
  }

  if (await ensureLedgerMode()) {
    try {
      const blockHeight = await getLedgerBlockHeight();
      mockBlockHeight = blockHeight;
      return {
        latestBlockHeight: blockHeight,
        totalQuotationTxs: mockTenderTxCount,
        totalTenderTxs: mockTenderTxCount,
        activeNodes: liveNodes || 14,
        totalInfrastructureNodes: INFRASTRUCTURE_NODE_COUNT,
        activeNodesLabel: `${liveNodes || 14}/${INFRASTRUCTURE_NODE_COUNT} Live`,
        averageBlockTimeSec: 2.1,
        channelId: CHANNEL_ID,
        ordererCluster: ORDERER_NODES.length,
        peerOrgs: 3,
        dataSource: 'ledger',
      };
    } catch (err) {
      logger.warn(`Ledger height query failed: ${err.message}`);
    }
  }

  const h = await getChannelBlockHeight('peer0.centralbank.gov');
  if (h != null && Number.isFinite(h)) {
    mockBlockHeight = h;
    const expSnap = getExperimentTelemetry();
    const txCount = expSnap?.totalTenderTxs ?? mockTenderTxCount;
    mockTenderTxCount = txCount;
    return {
      latestBlockHeight: h,
      totalQuotationTxs: txCount,
      totalTenderTxs: txCount,
      activeNodes: liveNodes || (expSnap?.activeNodes ?? 14),
      totalInfrastructureNodes: INFRASTRUCTURE_NODE_COUNT,
      activeNodesLabel: `${liveNodes || expSnap?.activeNodes || 14}/${INFRASTRUCTURE_NODE_COUNT} Live`,
      averageBlockTimeSec: expSnap?.averageBlockTimeSec ?? 2.1,
      channelId: CHANNEL_ID,
      ordererCluster: ORDERER_NODES.length,
      peerOrgs: 3,
      dataSource: expSnap ? 'mainnet_experiment' : 'peer-cli',
      experimentId: expSnap?.experimentId,
    };
  }

  const expSnap = getExperimentTelemetry();
  if (expSnap) {
    mockBlockHeight = expSnap.latestBlockHeight;
    mockTenderTxCount = expSnap.totalTenderTxs;
    return { ...expSnap, activeNodes: liveNodes || expSnap.activeNodes };
  }

  return {
    latestBlockHeight: mockBlockHeight,
    totalQuotationTxs: mockTenderTxCount,
    totalTenderTxs: mockTenderTxCount,
    activeNodes: liveNodes,
    totalInfrastructureNodes: INFRASTRUCTURE_NODE_COUNT,
    activeNodesLabel: `${liveNodes}/${INFRASTRUCTURE_NODE_COUNT} Live`,
    averageBlockTimeSec: 2.1,
    channelId: CHANNEL_ID,
    ordererCluster: ORDERER_NODES.length,
    peerOrgs: 3,
    dataSource: 'mock',
  };
}

export async function getLatestBlocks(count = 8) {
  if (useCloudSnapshot()) {
    const expBlocks = getExperimentBlocks(count);
    if (expBlocks.length) return expBlocks;
  }
  if (await ensureLedgerMode()) {
    try {
      const blocks = await getLedgerBlocks(count);
      if (blocks.length) return blocks;
    } catch (err) {
      logger.warn(`Ledger blocks failed: ${err.message}`);
    }
  }
  const peerH = await getChannelBlockHeight('peer0.centralbank.gov');
  if (peerH != null) mockBlockHeight = peerH;
  const expBlocks = getExperimentBlocks(count);
  if (expBlocks.length) return expBlocks;
  if (mockBlockHeight <= 0) mockBlockHeight = 23;
  return generateMockBlocks(count);
}

export async function getLatestTransactions(count = 12) {
  if (useCloudSnapshot()) {
    const expTxs = getExperimentTransactions(count);
    if (expTxs.length) return expTxs;
  }
  if (await ensureLedgerMode()) {
    try {
      const txs = await getLedgerTxs(count);
      if (txs.length) {
        mockTenderTxCount = Math.max(mockTenderTxCount, txs.length);
        return txs;
      }
    } catch (err) {
      logger.warn(`Ledger txs failed: ${err.message}`);
    }
  }
  const expTxs = getExperimentTransactions(count);
  if (expTxs.length) return expTxs;
  return generateMockTransactions(count);
}

export async function getSyncedNodes() {
  if (useCloudSnapshot()) {
    return getExperimentNodes();
  }
  let liveNodes = 0;
  try {
    const health = await inspectNodeHealth();
    liveNodes = health.liveCount;
  } catch { /* offline */ }
  return {
    nodes: [],
    liveCount: liveNodes,
    channelId: CHANNEL_ID,
    blockHeight: mockBlockHeight,
    dataSource: liveNodes ? 'docker' : 'mock',
  };
}

export async function getBlockDetail(blockNum) {
  const num = parseInt(blockNum, 10);
  const blocks = await getLatestBlocks(1);
  const found = blocks.find((b) => b.number === num);
  if (found) {
    return { ...found, transactions: await getLatestTransactions(20) };
  }
  return {
    number: num,
    hash: `0x${uuidv4().replace(/-/g, '')}`,
    time: new Date().toISOString(),
    txCount: 8,
    minedBy: 'Provincial Transport Dept.',
    channelId: CHANNEL_ID,
    transactions: generateMockTransactions(8),
    source: 'mock',
  };
}

export async function searchExplorer(query) {
  const q = (query || '').trim();
  if (!q) return { type: 'empty', results: [] };

  if (/^0x[a-f0-9]+$/i.test(q) || q.length > 20) {
    return { type: 'transaction', result: await getTransactionDetail(q) };
  }
  if (/^\d+$/.test(q)) {
    return { type: 'block', result: await getBlockDetail(q) };
  }
  if (q.includes('/')) {
    const txs = generateMockTransactions(5).filter((t) => t.value === q);
    return { type: 'asset_pair', results: txs };
  }
  return { type: 'unknown', query: q, results: [] };
}

export async function getTransactionDetail(txHash) {
  if (await ensureLedgerMode()) {
    try {
      return await getTransactionFromLedger(txHash);
    } catch (err) {
      logger.warn(`Ledger tx detail failed: ${err.message}`);
    }
  }

  const expTxs = getExperimentTransactions(50);
  const found = expTxs.find((t) => t.hash === txHash);
  if (found) {
    return {
      hash: found.hash,
      blockNumber: found.blockNumber,
      channelId: CHANNEL_ID,
      readSet: [{ key: `Commit:${TENDER_ID}:${found.from}`, version: found.blockNumber - 1 }],
      writeSet: [{ key: `${found.value}:${TENDER_ID}:${found.from}`, value: found.payload }],
      rwSetInspector: found.payload,
      endorsements: ['peer0.centralbank.gov', 'peer0.liquidity-bankA.com', 'peer0.liquidity-bankB.com'],
      source: 'mainnet_experiment',
      status: found.status,
      latencyMs: found.latencyMs,
    };
  }

  const payload = buildTenderPayload({
    tx_type: 'BID_REVEAL',
    bidder_id: 'Bidder-C',
    integrity_status: 'VERIFIED_SUCCESS',
    file_cid: 'ipfs://QmMaanshanSteelTruss3248mBoQ2024',
  });

  return {
    hash: txHash,
    blockNumber: mockBlockHeight,
    channelId: CHANNEL_ID,
    readSet: [{ key: `Commit:${TENDER_ID}:Bidder-C`, version: mockBlockHeight - 1 }],
    writeSet: [{ key: `Reveal:${TENDER_ID}:Bidder-C`, value: payload }],
    rwSetInspector: payload,
    endorsements: ['peer0.liquidity-bankA.com', 'peer0.centralbank.gov'],
    source: 'mock',
  };
}
