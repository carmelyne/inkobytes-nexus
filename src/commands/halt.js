/**
 * nexus halt "<reason>" — repo-wide circuit breaker.
 * Writes .nexus/HALT; while it exists, claim, release, and next refuse and
 * tell agents to stand by. Any agent or human may halt (an agent that smells
 * swarm-level trouble should be able to stop everyone). Only humans resume —
 * by convention, honored at session level, not mechanically enforced.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getConfig } from '../lib/config.js';

export function getHaltPath() {
  return join(getConfig().root, '.nexus', 'HALT');
}

export function getHalt() {
  const path = getHaltPath();
  if (!existsSync(path)) return null;
  try {
    const halt = JSON.parse(readFileSync(path, 'utf-8'));
    return {
      reason: halt.reason || '(no reason recorded)',
      at: halt.at || 'unknown',
      by: halt.by || 'unknown',
    };
  } catch {
    // A corrupt HALT file still halts; never let a parse error unfreeze the swarm.
    return { reason: '(unreadable HALT file)', at: 'unknown', by: 'unknown' };
  }
}

export function refuseIfHalted(command) {
  const halt = getHalt();
  if (!halt) return;
  console.error(`[HALTED] nexus ${command} refused — the swarm is halted.`);
  console.error(`  Reason: ${halt.reason}`);
  console.error(`  Since:  ${halt.at} by ${halt.by}`);
  console.error('Stand by: append a dated standup line noting you are halted, then stop.');
  console.error('Do not work around the halt with other tools. A human lifts it with `nexus resume`.');
  process.exit(1);
}

export default function halt(args) {
  const reason = (args[0] || '').trim();

  if (!reason || reason.startsWith('--')) {
    console.error('Usage: nexus halt "<reason>"');
    process.exit(1);
  }

  const existing = getHalt();
  if (existing) {
    console.log(`[INFO] Swarm is already halted since ${existing.at} by ${existing.by}: ${existing.reason}`);
    console.log('A human can lift it with `nexus resume`.');
    return;
  }

  const by = process.env.NEXUS_AGENT
    || (process.env.CLAUDECODE === '1' ? 'agent-session' : 'human');

  const haltPath = getHaltPath();
  mkdirSync(dirname(haltPath), { recursive: true });
  writeFileSync(haltPath, JSON.stringify({
    reason,
    at: new Date().toISOString(),
    by,
  }, null, 2), 'utf-8');

  console.log(`[HALT] Swarm halted: ${reason}`);
  console.log('claim, release, and next now refuse repo-wide until a human runs `nexus resume`.');
}
