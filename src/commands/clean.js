/**
 * nexus clean [--stale | <path>]
 * Surgical, stale, or nuke lock cleanup.
 */

import { removeEntry, clearBoard } from '../lib/blackboard.js';
import { releaseLock, breakStaleLocks, nukeAllLocks, getLockPath } from '../lib/lockManager.js';
import { existsSync } from 'fs';
import { createInterface } from 'readline';
import { normalizeTarget } from '../lib/pathSafety.js';

export default async function clean(args) {
  const mode = args[0];

  // Mode: stale — prune expired locks
  if (mode === '--stale') {
    const broken = breakStaleLocks();

    if (broken.length === 0) {
      console.log('No stale locks found.');
      return;
    }

    for (const { target, age } of broken) {
      removeEntry(`🔒 **${target}**`);
      console.log(`🩺 [STALE CLEAN] Unlocked: ${target} (${age}s old)`);
    }
    return;
  }

  // Mode: surgical — clean specific file/dir
  if (mode && mode !== '--nuke') {
    let target;
    try {
      target = normalizeTarget(mode);
    } catch (err) {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    }

    const lockPath = getLockPath(target);

    if (existsSync(lockPath)) {
      releaseLock(target);
      removeEntry(`🔒 **${target}**`);
      console.log(`🩺 [SURGICAL CLEAN] Unlocked: ${target}`);
    } else {
      console.log(`No lock found for: ${target}`);
    }
    return;
  }

  // Mode: nuke — clear everything (with confirmation)
  const confirmed = await confirm('⚠️  NUKE ALL LOCKS? (y/N): ');

  if (confirmed) {
    nukeAllLocks();
    clearBoard();
    console.log('[SYSTEM] Cleared all locks.');
  } else {
    console.log('Cancelled.');
  }
}

function confirm(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}
