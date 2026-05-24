/**
 * nexus status — pretty-print the current blackboard
 */

import { readBoard } from '../lib/blackboard.js';
import { listLocks } from '../lib/lockManager.js';
import { getConfig } from '../lib/config.js';

export default function status(args) {
  const config = getConfig();
  const locks = listLocks();

  if (locks.length === 0) {
    console.log('🐝 No active locks. The swarm is idle.');
    return;
  }

  console.log(`🐝 NEXUS STATUS — ${locks.length} active lock(s)\n`);

  // Read the blackboard for agent info
  const board = readBoard();
  const boardLines = board.split('\n').filter(l => l.includes('🔒'));

  for (const lock of locks) {
    const ageStr = lock.age !== null ? formatAge(lock.age) : '??';
    const stale = lock.age !== null && lock.age >= config.staleThreshold;

    // Find matching board line for agent info
    const boardLine = boardLines.find(l => l.includes(lock.target));
    const agentMatch = boardLine?.match(/Locked by \*\*(.+?)\*\*/);
    const agent = agentMatch ? agentMatch[1] : 'unknown';

    const staleTag = stale ? ' ⚠️  STALE' : '';
    console.log(`  🔒 ${lock.target}`);
    console.log(`     Agent: ${agent} | Age: ${ageStr}${staleTag}`);
  }

  console.log('');
}

function formatAge(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
