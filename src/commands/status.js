/**
 * nexus status — pretty-print the current blackboard
 */

import { readBoard } from '../lib/blackboard.js';
import { isSweepEligible, listLocks } from '../lib/lockManager.js';
import { evaluateLocksProgress } from '../lib/agentTrace.js';
import { getConfig } from '../lib/config.js';
import { spawnSync } from 'child_process';

const FILE_FLOW_WARNING = 'Stale claim. Commit this file now.';

export default function status(args) {
  const config = getConfig();
  const locks = listLocks();
  const generatedArtifacts = scanGeneratedArtifacts(config.root);

  if (locks.length === 0) {
    console.log('🐝 No active locks. The swarm is idle.');
    printGeneratedArtifacts(generatedArtifacts);
    return;
  }

  console.log(`🐝 NEXUS STATUS — ${locks.length} active lock(s)\n`);

  // Read the blackboard for agent info
  const board = readBoard();
  const boardLines = board.split('\n').filter(l => l.includes('🔒'));

  // One progress evaluation per lock, shared with the stale split so status
  // never calls a lock STALE that `clean --stale` would refuse to sweep.
  const progressByTarget = evaluateLocksProgress(locks);

  for (const lock of locks) {
    const ageStr = lock.age !== null ? formatAge(lock.age) : '??';
    const stale = isSweepEligible(lock, progressByTarget.get(lock.target));

    // Find matching board line for agent info
    const boardLine = boardLines.find(l => l.includes(lock.target));
    const agentMatch = boardLine?.match(/Locked by \*\*(.+?)\*\*/);
    const agent = agentMatch ? agentMatch[1] : 'unknown';

    const overdue = lock.age !== null && lock.age > config.claimTtl;
    const staleTag = stale ? ' ⚠️  STALE' : overdue ? ' ⏰ OVERDUE' : '';
    console.log(`  🔒 ${lock.target}`);
    console.log(`     Agent: ${agent} | Age: ${ageStr}${staleTag}`);
    if (stale) {
      console.log(`     Warning: ${FILE_FLOW_WARNING}`);
      continue;
    }

    const progress = progressByTarget.get(lock.target);
    if (progress) {
      const label = progress.progressing
        ? `active — progressing (${progress.signals[0]})`
        : `active — no progress signal (${lock.age !== null ? `${lock.age}s` : 'unknown age'})`;
      console.log(`     ${label}`);
    }
    if (overdue) {
      console.log(`     Overdue: held ${ageStr}, soft TTL is ${formatAge(config.claimTtl)}. ${agent} should release or announce in standup; do not edit through it.`);
    }
  }

  console.log('');
  printGeneratedArtifacts(generatedArtifacts);
}

function formatAge(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function printGeneratedArtifacts(artifacts) {
  if (artifacts.length === 0) return;

  console.log('Generated-looking artifacts need owner decision:');
  for (const artifact of artifacts) {
    console.log(`  • ${artifact}`);
  }
  console.log('    Decide keep/delete/ignore, or claim and release intentionally.');
}

function scanGeneratedArtifacts(root) {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) return [];

  const seen = new Set();
  const artifacts = [];
  for (const line of result.stdout.split('\n')) {
    if (!line.startsWith('?? ')) continue;
    const file = parseGitStatusPath(line.slice(3).trim());
    const ownerPath = generatedArtifactOwnerPath(file);
    if (!ownerPath || seen.has(ownerPath)) continue;
    seen.add(ownerPath);
    artifacts.push(ownerPath);
  }

  return artifacts;
}

function generatedArtifactOwnerPath(file) {
  const normalized = file.replace(/\\/g, '/');
  if (/(^|\/)(dist|build|coverage|tmp|temp|exports?|reports?|ledgers?|screenshots?)(\/|$)/i.test(normalized)) {
    return firstPathSegment(normalized);
  }
  if (/(^|\/)[^/]*\bcopy\b[^/]*(\/|$)/i.test(normalized)) {
    return firstPathSegment(normalized);
  }
  if (/\.(png|jpe?g|gif|webp|pdf|log|tmp)$/i.test(normalized)) {
    return normalized;
  }
  return '';
}

function parseGitStatusPath(file) {
  if (!file.startsWith('"') || !file.endsWith('"')) return file;

  try {
    return JSON.parse(file);
  } catch {
    return file.slice(1, -1);
  }
}

function firstPathSegment(file) {
  return file.split('/')[0];
}
