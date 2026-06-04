import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import { peerFqdn } from '../config/topology.js';
import { enrollDynamicPeer } from '../services/caProvisioner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = process.env.COMPOSE_PROJECT_DIR
  || path.resolve(__dirname, '../../..');

/**
 * Generate full network crypto via cryptogen (bootstrap).
 */
export async function generateNetworkCrypto() {
  const configPath = path.join(WORKSPACE_ROOT, 'config/crypto-config.yaml');
  const outDir = path.join(WORKSPACE_ROOT, 'organizations');

  return runCommand('cryptogen', [
    'generate',
    '--config', configPath,
    '--output', outDir,
  ], { cwd: WORKSPACE_ROOT, timeoutMs: 120_000 });
}

/**
 * On-the-fly MSP/TLS material for a dynamically added peer.
 * Phase 1: extend org tree by cloning peer0 template + re-enroll via Fabric CA script hook.
 */
export async function provisionDynamicPeerCrypto({ orgDomain, peerIndex }) {
  const fqdn = peerFqdn(orgDomain, peerIndex);
  const script = path.join(WORKSPACE_ROOT, 'scripts/provision-dynamic-peer.sh');

  logger.info(`Provisioning crypto for ${fqdn}`);

  try {
    return await enrollDynamicPeer({ orgDomain, peerIndex });
  } catch (sdkErr) {
    logger.warn(`Fabric CA SDK enroll failed: ${sdkErr.message}`);
  }

  try {
    await runCommand('bash', [script, orgDomain, String(peerIndex)], {
      cwd: WORKSPACE_ROOT,
      timeoutMs: 180_000,
    });
    return {
      fqdn,
      mspPath: path.join(
        WORKSPACE_ROOT,
        'organizations/peerOrganizations',
        orgDomain,
        'peers',
        fqdn,
        'msp',
      ),
      tlsPath: path.join(
        WORKSPACE_ROOT,
        'organizations/peerOrganizations',
        orgDomain,
        'peers',
        fqdn,
        'tls',
      ),
      method: 'fabric-ca-enroll',
    };
  } catch (err) {
    logger.warn(`CA enroll failed, falling back to peer0 clone: ${err.message}`);
    const fallback = path.join(WORKSPACE_ROOT, 'scripts/clone-peer-crypto.sh');
    await runCommand('bash', [fallback, orgDomain, String(peerIndex)], {
      cwd: WORKSPACE_ROOT,
      timeoutMs: 60_000,
    });
    return { fqdn, method: 'template-clone', warning: 'Use Fabric CA in production' };
  }
}
