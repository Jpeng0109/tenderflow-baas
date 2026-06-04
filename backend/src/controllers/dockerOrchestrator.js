import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import {
  CHANNEL_ID,
  couchFqdn,
  peerFqdn,
  computePeerPort,
  PEER_ORGS,
} from '../config/topology.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = process.env.COMPOSE_PROJECT_DIR
  || path.resolve(__dirname, '../../..');
const COMPOSE_FILE = process.env.COMPOSE_FILE || 'docker/docker-compose-fabric-14.yaml';
const FABRIC_VERSION = process.env.FABRIC_VERSION || '2.5.12';
const COUCH_PASSWORD = process.env.COUCHDB_PASSWORD || 'fxbridge_couch_secret';

/** @type {Map<string, { fqdn: string, org: string, index: number, port: number, dynamic: boolean }>} */
const dynamicPeerRegistry = new Map();

function composeArgs(extra = []) {
  return [
    'compose',
    '-f', path.join(WORKSPACE_ROOT, COMPOSE_FILE),
    '--env-file', path.join(WORKSPACE_ROOT, 'docker/.env'),
    ...extra,
  ];
}

function dockerBin() {
  return process.platform === 'win32' ? 'docker.exe' : 'docker';
}

/**
 * Bring up the full 14-node Fabric cluster via docker compose.
 */
export async function startFabricCluster(services = []) {
  const args = composeArgs(['up', '-d', ...services]);
  return runCommand(dockerBin(), args, { cwd: WORKSPACE_ROOT, timeoutMs: 600_000 });
}

/**
 * Stop and remove a specific peer (+ couchdb) container.
 */
export async function stopPeerServices(fqdn) {
  const couch = fqdn.replace(/^peer/, 'couchdb');
  const args = composeArgs(['rm', '-sf', fqdn, couch]);
  return runCommand(dockerBin(), args, { cwd: WORKSPACE_ROOT });
}

/**
 * Programmatically spawn a new liquidity peer via `docker run`.
 * Used for dynamic scale-up (e.g. peer3.liquidity-bankA.com).
 */
export async function spawnDynamicPeer({ orgDomain, peerIndex }) {
  const org = PEER_ORGS[orgDomain];
  if (!org) throw new Error(`Org not eligible for dynamic peers: ${orgDomain}`);
  if (org.maxDynamic === 0) {
    throw new Error('Regulatory org does not support dynamic peer provisioning');
  }

  const fqdn = peerFqdn(orgDomain, peerIndex);
  const couch = couchFqdn(orgDomain, peerIndex);
  const listenPort = computePeerPort(orgDomain, peerIndex);
  const ccPort = listenPort + 1;
  const network = 'fx-bridge_fx_bridge';

  if (dynamicPeerRegistry.has(fqdn)) {
    throw new Error(`Peer already registered: ${fqdn}`);
  }

  const orgPath = path.join(
    WORKSPACE_ROOT,
    'organizations/peerOrganizations',
    orgDomain,
    'peers',
    fqdn,
  );

  // CouchDB sidecar
  const couchRunArgs = [
    'run', '-d',
    '--name', couch,
    '--network', network,
    `-e`, `COUCHDB_USER=admin`,
    `-e`, `COUCHDB_PASSWORD=${COUCH_PASSWORD}`,
    `couchdb:3.4.2`,
  ];
  await runCommand(dockerBin(), couchRunArgs);

  const peerRunArgs = [
    'run', '-d',
    '--name', fqdn,
    '--network', network,
    '-v', `${orgPath}:/etc/hyperledger/fabric`,
    '-v', '/var/run/docker.sock:/host/var/run/docker.sock',
    '-p', `${listenPort}:${listenPort}`,
    '-p', `${ccPort}:${ccPort}`,
    '-e', 'CORE_LEDGER_STATE_STATEDATABASE=CouchDB',
    '-e', `CORE_PEER_ID=${fqdn}`,
    '-e', `CORE_PEER_ADDRESS=${fqdn}:${listenPort}`,
    '-e', `CORE_PEER_LISTENADDRESS=0.0.0.0:${listenPort}`,
    '-e', `CORE_PEER_CHAINCODEADDRESS=${fqdn}:${ccPort}`,
    '-e', `CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:${ccPort}`,
    '-e', `CORE_PEER_LOCALMSPID=${org.mspId}`,
    '-e', 'CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp',
    '-e', 'CORE_PEER_TLS_ENABLED=true',
    '-e', 'CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt',
    '-e', 'CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key',
    '-e', 'CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt',
    '-e', `CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=${couch}:5984`,
    '-e', 'CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin',
    '-e', `CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=${COUCH_PASSWORD}`,
    '-e', 'CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock',
    '-e', `CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=${network}`,
    `hyperledger/fabric-peer:${FABRIC_VERSION}`,
  ];

  const result = await runCommand(dockerBin(), peerRunArgs, { timeoutMs: 120_000 });

  dynamicPeerRegistry.set(fqdn, {
    fqdn,
    org: orgDomain,
    index: peerIndex,
    port: listenPort,
    dynamic: true,
  });

  logger.info(`Dynamic peer spawned: ${fqdn}`, { listenPort });
  return { fqdn, couch, listenPort, containerId: result.stdout.trim().slice(0, 12) };
}

/**
 * Decommission: stop container, revoke certs placeholder, remove from registry.
 */
export async function decommissionPeer(fqdn) {
  const couch = fqdn.replace(/^peer/, 'couchdb');

  await runCommand(dockerBin(), ['rm', '-f', fqdn], { timeoutMs: 60_000 }).catch(() => {});
  await runCommand(dockerBin(), ['rm', '-f', couch], { timeoutMs: 60_000 }).catch(() => {});

  dynamicPeerRegistry.delete(fqdn);

  const revokeScript = path.join(WORKSPACE_ROOT, 'scripts/revoke-peer-cert.sh');
  await runCommand('bash', [revokeScript, fqdn], { cwd: WORKSPACE_ROOT }).catch((err) => {
    logger.warn(`Cert revocation script skipped: ${err.message}`);
  });

  return { fqdn, status: 'decommissioned' };
}

/**
 * List docker container states for topology map.
 */
export async function inspectNodeHealth() {
  const { stdout } = await runCommand(
    dockerBin(),
    ['ps', '-a', '--filter', 'name=clearing-raft.org', '--filter', 'name=centralbank.gov',
      '--filter', 'name=liquidity-bankA.com', '--filter', 'name=liquidity-bankB.com',
      '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}'],
    { timeoutMs: 30_000 },
  );

  const rows = stdout.trim().split('\n').filter(Boolean).map((line) => {
    const [name, status, ports] = line.split('\t');
    return {
      name,
      status,
      ports,
      live: status?.toLowerCase().startsWith('up'),
    };
  });

  const liveCount = rows.filter((r) => r.live).length;
  return { nodes: rows, liveCount, channelId: CHANNEL_ID };
}

export function getDynamicPeers() {
  return Array.from(dynamicPeerRegistry.values());
}
