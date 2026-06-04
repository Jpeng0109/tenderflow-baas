import { spawn } from 'node:child_process';
import { logger } from './logger.js';

/**
 * Execute a shell command and capture stdout/stderr.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number }} opts
 */
export function runCommand(command, args = [], opts = {}) {
  const { cwd, env, timeoutMs = 300_000 } = opts;

  return new Promise((resolve, reject) => {
    logger.info(`exec: ${command} ${args.join(' ')}`, { cwd });

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        const err = new Error(`Exit ${code}: ${command} ${args.join(' ')}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        reject(err);
      }
    });
  });
}
