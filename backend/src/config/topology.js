/**
 * TENDERFLOW — 14-node Hyperledger Fabric topology
 * Ma'anshan Yangtze River Bridge construction tendering experiment
 *
 * Infrastructure: 5 RAFT orderers + 9 endorsing peers (3 orgs × 3)
 * Channel: tenderflow-channel | State DB: CouchDB
 *
 * Paper role mapping (Section 5.2):
 *   Orderers (5)     → Tender consensus / block ordering cluster
 *   centralbank.gov  → Provincial Transport Dept. (Regulator / Owner) — 3 peers
 *   liquidity-bankA  → Tier-1 Construction Consortium (8 bidders via client apps) — 3 peers
 *   liquidity-bankB  → Audit & Financial Supervision (2 auditors + 2 banks) — 3 peers
 */

export const CHANNEL_ID = process.env.CHANNEL_ID || 'fx-bridge-channel';
export const PROJECT_NAME = "Ma'anshan Yangtze River Bridge";
export const TENDER_ID = 'MAS-2024-BRIDGE-001';

export const ORDERER_NODES = [
  { id: 'orderer1', fqdn: 'orderer1.clearing-raft.org', port: 7050, role: 'raft', label: 'Consensus Node 1' },
  { id: 'orderer2', fqdn: 'orderer2.clearing-raft.org', port: 8050, role: 'raft', label: 'Consensus Node 2' },
  { id: 'orderer3', fqdn: 'orderer3.clearing-raft.org', port: 9050, role: 'raft', label: 'Consensus Node 3' },
  { id: 'orderer4', fqdn: 'orderer4.clearing-raft.org', port: 10050, role: 'raft', label: 'Consensus Node 4' },
  { id: 'orderer5', fqdn: 'orderer5.clearing-raft.org', port: 11050, role: 'raft', label: 'Consensus Node 5' },
];

export const PEER_ORGS = {
  'centralbank.gov': {
    mspId: 'CentralBankMSP',
    basePort: 7051,
    portStep: 2,
    maxDynamic: 0,
    role: 'regulator_owner',
    displayName: 'Provincial Transport Dept. (Regulator)',
    paperRole: '4 Regulator nodes (3 endorsing peers + 1 client gateway)',
    orgType: 'Regulator',
  },
  'liquidity-bankA.com': {
    mspId: 'LiquidityBankAMSP',
    basePort: 9051,
    portStep: 2,
    maxDynamic: 5,
    role: 'tier1_constructor',
    displayName: 'Tier-1 Construction Consortium',
    paperRole: '8 Tier-1 Construction Co. nodes (multiplexed)',
    orgType: 'Bidder',
  },
  'liquidity-bankB.com': {
    mspId: 'LiquidityBankBMSP',
    basePort: 11051,
    portStep: 2,
    maxDynamic: 5,
    role: 'audit_finance',
    displayName: 'Audit & Financial Supervision',
    paperRole: '2 Auditor + 2 Financial Institution nodes',
    orgType: 'Auditor/Finance',
  },
};

export const BASE_PEERS = [
  { fqdn: 'peer0.centralbank.gov', org: 'centralbank.gov', index: 0, port: 7051 },
  { fqdn: 'peer1.centralbank.gov', org: 'centralbank.gov', index: 1, port: 7053 },
  { fqdn: 'peer2.centralbank.gov', org: 'centralbank.gov', index: 2, port: 7055 },
  { fqdn: 'peer0.liquidity-bankA.com', org: 'liquidity-bankA.com', index: 0, port: 9051 },
  { fqdn: 'peer1.liquidity-bankA.com', org: 'liquidity-bankA.com', index: 1, port: 9053 },
  { fqdn: 'peer2.liquidity-bankA.com', org: 'liquidity-bankA.com', index: 2, port: 9055 },
  { fqdn: 'peer0.liquidity-bankB.com', org: 'liquidity-bankB.com', index: 0, port: 11051 },
  { fqdn: 'peer1.liquidity-bankB.com', org: 'liquidity-bankB.com', index: 1, port: 11053 },
  { fqdn: 'peer2.liquidity-bankB.com', org: 'liquidity-bankB.com', index: 2, port: 11055 },
];

export const SIMULATION_BIDDERS = [
  { id: 'Bidder-A', name: 'China Bridge Group', verifiedRep: 0.95, scenario: 'High V, shadow bidding history' },
  { id: 'Bidder-B', name: 'Yangtze Infrastructure Co.', verifiedRep: 0.95, scenario: 'High V, recent bond breach' },
  { id: 'Bidder-C', name: 'Maanshan Steel Truss Ltd.', verifiedRep: 0.78, scenario: '12 consecutive successes' },
  { id: 'Bidder-D', name: 'East China Construction', verifiedRep: 0.82, scenario: 'Stable performer' },
  { id: 'Bidder-E', name: 'Huaihe Engineering Corp.', verifiedRep: 0.80, scenario: 'Mid-tier' },
  { id: 'Bidder-F', name: 'Jiangsu Mega-Bridge Inc.', verifiedRep: 0.88, scenario: 'Strong certifications' },
  { id: 'Bidder-G', name: 'Anhui Road-Rail Joint Venture', verifiedRep: 0.76, scenario: 'New entrant' },
  { id: 'Bidder-H', name: 'Golden River Contractors', verifiedRep: 0.74, scenario: 'New entrant' },
];

export const INFRASTRUCTURE_NODE_COUNT = ORDERER_NODES.length + BASE_PEERS.length;

export function peerFqdn(orgDomain, index) {
  return `peer${index}.${orgDomain}`;
}

export function couchFqdn(orgDomain, index) {
  return `couchdb${index}.${orgDomain}`;
}

export function computePeerPort(orgDomain, index) {
  const org = PEER_ORGS[orgDomain];
  if (!org) throw new Error(`Unknown org domain: ${orgDomain}`);
  return org.basePort + index * org.portStep;
}
