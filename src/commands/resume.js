/**
 * nexus resume — lift a halt. Human-owned by convention.
 * The session check below is advisory (env vars an agent could unset), the
 * same honesty caveat as promptCHMOD: it deters, it does not enforce.
 */

import { rmSync } from 'fs';
import { getHalt, getHaltPath } from './halt.js';

export default function resume() {
  const halt = getHalt();

  if (!halt) {
    console.log('[INFO] No halt in place. Nothing to resume.');
    return;
  }

  const inAgentSession = process.env.CLAUDECODE === '1' || !!process.env.NEXUS_AGENT;
  if (inAgentSession) {
    console.error('[ERROR] nexus resume is human-owned: agents may halt, only humans resume.');
    console.error('This check is advisory (session env vars), not enforcement — honor it.');
    console.error('Ask the human to run `nexus resume` from a plain terminal.');
    process.exit(1);
  }

  rmSync(getHaltPath(), { force: true });
  console.log(`[RESUME] Halt lifted (was: ${halt.reason} — ${halt.at} by ${halt.by}).`);
  console.log('claim, release, and next are available again.');
}
