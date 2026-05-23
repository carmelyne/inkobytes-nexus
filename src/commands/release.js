/**
 * nexus release <path> "<commit message>"
 * Unlock, auto-commit, update blackboard, log to report.
 */

import { appendFileSync } from 'fs';
import { removeEntry } from '../lib/blackboard.js';
import { releaseLock } from '../lib/lockManager.js';
import { stageAndCommit } from '../lib/git.js';
import { getConfig } from '../lib/config.js';
import { normalizeTarget } from '../lib/pathSafety.js';

export default function release(args) {
  let target = args[0];

  if (!target) {
    console.error('Usage: nexus release <filepath_or_dir> "<commit message>"');
    process.exit(1);
  }

  try {
    target = normalizeTarget(target);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }

  const commitMsg = args[1] || `chore: agent updated ${target}`;

  // Stage and commit first
  const gitResult = stageAndCommit(target, commitMsg);
  if (!gitResult.success && !gitResult.message?.includes('clean')) {
    console.error(`[ERROR] ${gitResult.message}`);
    process.exit(1);
  }

  // Release the lock
  const lockResult = releaseLock(target);
  if (!lockResult.success) {
    console.warn(`[WARN] ${lockResult.message}`);
  }

  // Remove from blackboard
  removeEntry(`🔒 **${target}**`);

  // Append to report
  const config = getConfig();
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const reportLine = `- [${timestamp}] ✅ **${target}** - ${commitMsg}\n`;

  try {
    appendFileSync(config.report, reportLine, 'utf-8');
  } catch { /* report file might not exist yet */ }

  console.log('[LOCK RELEASED & COMMITTED]');
}
