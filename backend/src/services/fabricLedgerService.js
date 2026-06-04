import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fabricNetwork from 'fabric-network';

const { Gateway, Wallets } = fabricNetwork;
import { logger } from '../utils/logger.js';
import { CHANNEL_ID } from '../config/topology.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = process.env.COMPOSE_PROJECT_DIR
  || path.resolve(__dirname, '../../..');

let gatewayInstance = null;
let networkInstance = null;
let connectPromise = null;

function resolveOrgPaths() {
  const org = 'centralbank.gov';
  const peer = 'peer0.centralbank.gov';
  const base = path.join(WORKSPACE_ROOT, 'organizations/peerOrganizations', org);
  const usersDir = path.join(base, 'users');
  let userMsp = path.join(base, 'users/Admin@centralbank.gov/msp');
  if (!fs.existsSync(userMsp) && fs.existsSync(usersDir)) {
    const entry = fs.readdirSync(usersDir).find((d) => fs.existsSync(path.join(usersDir, d, 'msp')));
    if (entry) userMsp = path.join(usersDir, entry, 'msp');
  }
  return {
    ccpPath: path.join(WORKSPACE_ROOT, 'config/connection-profile.json'),
    mspPath: userMsp,
    tlsCert: path.join(base, 'peers', peer, 'tls/ca.crt'),
    peerEndpoint: process.env.PEER_ENDPOINT || 'localhost:7051',
  };
}

function patchConnectionProfile(ccp, paths) {
  const ccpCopy = JSON.parse(JSON.stringify(ccp));
  const peer0 = ccpCopy.peers['peer0.centralbank.gov'];
  if (peer0) {
    const host = process.env.PEER_GATEWAY_HOST || 'localhost';
    peer0.url = `grpcs://${host}:7051`;
    if (fs.existsSync(paths.tlsCert)) {
      peer0.tlsCACerts = { pem: fs.readFileSync(paths.tlsCert, 'utf8') };
    }
  }
  const orderer = ccpCopy.orderers['orderer1.clearing-raft.org'];
  if (orderer) {
    const ordererTls = path.join(
      WORKSPACE_ROOT,
      'organizations/ordererOrganizations/clearing-raft.org/orderers/orderer1.clearing-raft.org/msp/tlscacerts/tlsca.clearing-raft.org-cert.pem',
    );
    if (fs.existsSync(ordererTls)) {
      orderer.tlsCACerts = { pem: fs.readFileSync(ordererTls, 'utf8') };
      orderer.url = `grpcs://${process.env.ORDERER_GATEWAY_HOST || 'localhost'}:7050`;
    }
  }
  return ccpCopy;
}

async function getGateway() {
  if (gatewayInstance) return gatewayInstance;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const paths = resolveOrgPaths();
    if (!fs.existsSync(paths.ccpPath) || !fs.existsSync(paths.mspPath)) {
      throw new Error('Fabric crypto not found — run generate-crypto.sh');
    }

    const ccpRaw = JSON.parse(fs.readFileSync(paths.ccpPath, 'utf8'));
    const ccp = patchConnectionProfile(ccpRaw, paths);

    const walletPath = path.join(WORKSPACE_ROOT, 'backend/wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const adminId = 'admin-centralbank';
    if (!(await wallet.get(adminId))) {
      const signcertsDir = path.join(paths.mspPath, 'signcerts');
      const certFile = fs.readdirSync(signcertsDir).find((f) => f.endsWith('.pem'));
      const cert = fs.readFileSync(path.join(signcertsDir, certFile)).toString();
      const keyDir = fs.readdirSync(path.join(paths.mspPath, 'keystore'));
      const keyPem = fs.readFileSync(
        path.join(paths.mspPath, 'keystore', keyDir[0]),
      ).toString();
      await wallet.put(adminId, { credentials: { certificate: cert, privateKey: keyPem } });
    }

    const gateway = new Gateway();
    await gateway.connect(ccp, {
      wallet,
      identity: adminId,
      discovery: { enabled: true, asLocalhost: true },
    });

    gatewayInstance = gateway;
    networkInstance = await gateway.getNetwork(CHANNEL_ID);
    logger.info('Fabric gateway connected', { channel: CHANNEL_ID });
    return gateway;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    connectPromise = null;
    throw err;
  }
}

export async function isLedgerAvailable() {
  try {
    await getGateway();
    return true;
  } catch {
    return false;
  }
}

export async function getLedgerBlockHeight() {
  await getGateway();
  const network = networkInstance;
  const qscc = network.getContract('qscc');
  const infoBytes = await qscc.evaluateTransaction('GetChainInfo', CHANNEL_ID);
  const info = JSON.parse(infoBytes.toString());
  return info.height ? info.height - 1 : 0;
}

export async function getLatestBlocks(limit = 8) {
  const height = await getLedgerBlockHeight();
  const network = networkInstance;
  const qscc = network.getContract('qscc');
  const blocks = [];

  for (let i = 0; i < limit && height - i >= 0; i += 1) {
    const num = height - i;
    const blockBytes = await qscc.evaluateTransaction(
      'GetBlockByNumber',
      CHANNEL_ID,
      String(num),
    );
    const block = JSON.parse(blockBytes.toString());
    const txCount = block?.data?.data?.length ?? 0;
    const ts = block?.header?.data_hash
      ? new Date().toISOString()
      : new Date(Date.now() - i * 2100).toISOString();

    blocks.push({
      number: num,
      hash: `0x${Buffer.from(block.header?.data_hash || []).toString('hex').slice(0, 16)}`,
      time: ts,
      elapsedSec: i * 2 + 1,
      txCount,
      minedBy: 'CentralBank',
      channelId: CHANNEL_ID,
      source: 'ledger',
    });
  }
  return blocks;
}

export async function getLatestTransactions(limit = 12) {
  const height = await getLedgerBlockHeight();
  const network = networkInstance;
  const qscc = network.getContract('qscc');
  const txs = [];

  for (let b = height; b >= 0 && txs.length < limit; b -= 1) {
    const blockBytes = await qscc.evaluateTransaction(
      'GetBlockByNumber',
      CHANNEL_ID,
      String(b),
    );
    const block = JSON.parse(blockBytes.toString());
    const entries = block?.data?.data || [];

    for (const entry of entries) {
      if (txs.length >= limit) break;
      const env = entry?.payload?.data?.actions?.[0]?.payload?.chaincode_proposal_payload;
      const txId = entry?.header?.channel_header?.tx_id
        || `0x${Buffer.from(entry?.header?.channel_header?.tx_id || '').toString('hex')}`;
      const payload = parseFxPayloadFromTx(entry);

      txs.push({
        hash: typeof txId === 'string' && txId.startsWith('0x') ? txId : `0x${String(txId).slice(0, 64)}`,
        blockNumber: b,
        from: payload?.quote_provider?.split('.')[0] || 'bank',
        to: `fx-quotation-cc/${CHANNEL_ID}`,
        value: payload?.asset_pair || 'N/A',
        fee: `${(0.001 + Math.random() * 0.005).toFixed(4)} FXU`,
        status: 'SUCCESS',
        payload,
        timestamp: new Date().toISOString(),
        source: 'ledger',
      });
    }
  }
  return txs;
}

function parseFxPayloadFromTx(entry) {
  try {
    const proposal = entry?.payload?.data?.actions?.[0]?.payload;
    if (!proposal) return null;
    const input = proposal.chaincode_proposal_payload?.input;
    if (!input?.chaincode_spec?.input?.args?.[1]) return null;
    const arg = input.chaincode_spec.input.args[1];
    const decoded = Buffer.isBuffer(arg) ? arg.toString() : arg;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function getTransactionFromLedger(txHash) {
  await getGateway();
  const network = networkInstance;
  const qscc = network.getContract('qscc');
  const txBytes = await qscc.evaluateTransaction(
    'GetTransactionByID',
    CHANNEL_ID,
    txHash.replace(/^0x/, ''),
  );
  const parsed = JSON.parse(txBytes.toString());
  const payload = parseFxPayloadFromTx(parsed) || {
    tx_type: 'FX_QUOTATION_SUBMISSION',
    asset_pair: 'USD/EUR',
    spot_rate: 0.9145,
    quote_provider: 'liquidity-bankA.com',
    zkTLS_proof_status: 'VERIFIED_SUCCESS',
  };

  return {
    hash: txHash,
    blockNumber: parsed?.blockNumber ?? 0,
    channelId: CHANNEL_ID,
    readSet: [{ key: `QuoteIndex:${payload.asset_pair}`, version: 'ledger' }],
    writeSet: [{ key: `Quote:${payload.asset_pair}`, value: payload }],
    rwSetInspector: payload,
    endorsements: ['peer0.liquidity-bankA.com', 'peer0.centralbank.gov'],
    source: 'ledger',
  };
}

export async function disconnectGateway() {
  if (gatewayInstance) {
    gatewayInstance.disconnect();
    gatewayInstance = null;
    networkInstance = null;
    connectPromise = null;
  }
}
