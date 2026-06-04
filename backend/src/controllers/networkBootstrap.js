import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import { startFabricCluster } from './dockerOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.COMPOSE_PROJECT_DIR || path.resolve(__dirname, '../../..');

const STEPS = [
  { id: 1, name: 'generate-crypto', script: 'generate-crypto.sh' },
  { id: 2, name: 'init-fabric-ca', script: 'init-fabric-ca.sh', optional: true },
  { id: 3, name: 'channel-artifacts', script: 'generate-channel-artifacts.sh' },
  { id: 4, name: 'docker-compose-up', fn: 'compose' },
  { id: 5, name: 'channel-setup', script: 'channel-setup.sh', optional: true },
  { id: 6, name: 'deploy-chaincode', script: 'deploy-chaincode.sh', optional: true },
];

function bash(script) {
  const scriptPath = path.join(ROOT, 'scripts', script);
  return runCommand('bash', [scriptPath], { cwd: ROOT, timeoutMs: 600_000 });
}

export async function runFullBootstrap() {
  const results = [];

  for (const step of STEPS) {
    try {
      if (step.fn === 'compose') {
        await startFabricCluster();
        results.push({ step: step.name, ok: true });
        await new Promise((r) => setTimeout(r, 25_000));
      } else {
        await bash(step.script);
        results.push({ step: step.name, ok: true });
      }
      logger.info(`Bootstrap step done: ${step.name}`);
    } catch (err) {
      if (step.optional) {
        results.push({ step: step.name, ok: false, warning: err.message });
      } else {
        results.push({ step: step.name, ok: false, error: err.message });
        return { ok: false, results };
      }
    }
  }

  return { ok: true, results, channelId: 'fx-bridge-channel' };
}
