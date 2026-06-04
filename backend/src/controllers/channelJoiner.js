import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../utils/shell.js';
import { CHANNEL_ID } from '../config/topology.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = process.env.COMPOSE_PROJECT_DIR
  || path.resolve(__dirname, '../../..');

/**
 * Force a peer container to join fx-bridge-channel.
 */
export async function joinPeerToChannel(fqdn) {
  const script = path.join(WORKSPACE_ROOT, 'scripts/peer-channel-join.sh');
  const { stdout, stderr } = await runCommand('bash', [script, fqdn, CHANNEL_ID], {
    cwd: WORKSPACE_ROOT,
    timeoutMs: 180_000,
  });
  return { fqdn, channelId: CHANNEL_ID, stdout, stderr };
}

/**
 * Fetch channel block height from peer (via peer CLI in fabric-cli or exec).
 */
export async function getChannelBlockHeight(fqdn = 'peer0.centralbank.gov') {
  try {
    const { stdout, stderr } = await runCommand(
      'docker',
      ['exec', fqdn, 'peer', 'channel', 'getinfo', '-c', CHANNEL_ID],
      { timeoutMs: 30_000 },
    );
    const m = (stdout + stderr).match(/"height":(\d+)/);
    const height = m ? parseInt(m[1], 10) : NaN;
    return Number.isFinite(height) ? height : null;
  } catch {
    return null;
  }
}
