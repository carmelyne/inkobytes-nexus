/**
 * nexus release <path> "<commit message>"
 * Unlock, auto-commit, update blackboard, log to report.
 */

import { appendFileSync } from 'fs';
import { removeEntry } from '../lib/blackboard.js';
import { listLocks, readGitHead, releaseLock } from '../lib/lockManager.js';
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
  const lock = listLocks().find((entry) => entry.target === target);
  const config = getConfig();
  const releaseHead = readGitHead(config.root);
  const claimHead = lock?.claimHead || 'unknown';
  const hasHeadDrift = claimHead !== 'unknown' && releaseHead !== 'unknown' && claimHead !== releaseHead;

  if (hasHeadDrift) {
    console.warn(`[WARN] HEAD changed since claim for ${target}: claimed ${shortSha(claimHead)}, releasing from ${shortSha(releaseHead)}. Review interleaved commits if needed.`);
  }

  // Stage and commit first
  const gitResult = stageAndCommit(target, commitMsg, lock?.agent || '');
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
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const reportLine = `## [${timestamp}] ${target}

- Agent: ${lock?.agent || 'unknown'}
- Target: ${target}
- Claim HEAD: ${claimHead}
- Release HEAD: ${releaseHead}
- Drift: ${hasHeadDrift ? 'yes' : 'no'}
- SHA: ${gitResult.sha || 'unknown'}
- Commit: ${commitMsg}

`;

  try {
    appendFileSync(config.report, reportLine, 'utf-8');
  } catch { /* report file might not exist yet */ }

  console.log('[LOCK RELEASED & COMMITTED]');
}

function shortSha(sha) {
  return sha === 'unknown' ? sha : sha.slice(0, 7);
}
