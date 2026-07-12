/**
 * nexus release <path> "<commit message>"
 * Unlock, auto-commit, update blackboard, log to report.
 */

import { appendFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { removeEntry } from '../lib/blackboard.js';
import { listLocks, readGitHead, readGitPathStatus, releaseLock } from '../lib/lockManager.js';
import { stageAndCommit } from '../lib/git.js';
import { getConfig } from '../lib/config.js';
import { normalizeTarget } from '../lib/pathSafety.js';
import { appendCompletedLedgerEntries } from './ledger.js';
import { refuseIfHalted } from './halt.js';

export default function release(args) {
  refuseIfHalted('release');

  const noVerify = args.includes('--no-verify');
  const includePreexisting = args.includes('--include-preexisting');
  const positional = args.filter((arg) => arg !== '--no-verify' && arg !== '--include-preexisting');
  let target = positional[0];

  if (!target) {
    console.error('Usage: nexus release <filepath_or_dir> "<commit message>" [--no-verify] [--include-preexisting]');
    process.exit(1);
  }

  try {
    target = normalizeTarget(target);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }

  const commitMsg = positional[1] || `chore: agent updated ${target}`;
  const lock = listLocks().find((entry) => entry.target === target);
  // Attribution fallback: a stale-broken lock must not erase who did the
  // work. Prefer the live lock, then the NEXUS_AGENT env; the ledger adds a
  // final queue task-owner fallback.
  const releaseAgent = lock?.agent || (process.env.NEXUS_AGENT || '').trim();
  const config = getConfig();
  const releaseHead = readGitHead(config.root);
  const claimHead = lock?.claimHead || 'unknown';
  const hasHeadDrift = claimHead !== 'unknown' && releaseHead !== 'unknown' && claimHead !== releaseHead;

  if (hasHeadDrift) {
    console.warn(`[WARN] HEAD changed since claim for ${target}: claimed ${shortSha(claimHead)}, releasing from ${shortSha(releaseHead)}. Review interleaved commits if needed.`);
  }

  // Sweep guard (release-sweep-guard): a release commits everything
  // uncommitted under the target, so show exactly what that is, and refuse
  // when part of it predates the claim — that is another agent's (or an
  // earlier session's) work, not this claim's.
  const pendingStatus = readGitPathStatus(target, config.root);
  if (pendingStatus) {
    console.log(`[DIFF] Changes to be committed for ${target}:`);
    printPendingChanges(config.root, target, pendingStatus);
  }

  if (lock?.dirtyAtClaim === 'true') {
    if (!includePreexisting) {
      console.error(`[ERROR] ${target} already had uncommitted changes before this claim was taken. Releasing would sweep pre-claim work into this commit.`);
      console.error('Review the diff above. Re-run with --include-preexisting to commit everything, or coordinate ownership in standup first.');
      console.error(`Release refused; your claim on ${target} is kept.`);
      appendStandupLine(config, `${standupTimestamp()} ${releaseAgent || 'unknown'} [BLOCKED]: release ${target} refused — pre-claim uncommitted changes present (re-run with --include-preexisting)`);
      process.exit(1);
    }
    console.warn(`[WARN] Committing changes that predate the claim on ${target} (--include-preexisting).`);
  }

  runVerifyGate({ config, target, agent: releaseAgent || 'unknown', noVerify });

  // Stage and commit first
  const gitResult = stageAndCommit(target, commitMsg, releaseAgent);
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

  if (target === '_NEXUS_REPORT.md') {
    console.log('[INFO] Skipped report append for _NEXUS_REPORT.md release to avoid self-noise.');
    console.log('[LOCK RELEASED & COMMITTED]');
    return;
  }

  // Append to report
  const timestamp = formatReportTimestamp(new Date());
  const reportLine = `## [${timestamp}] ${target}

- Agent: ${releaseAgent || 'unknown'}
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

  try {
    const count = appendCompletedLedgerEntries({
      target,
      agent: releaseAgent || 'unknown',
      sha: gitResult.sha || 'unknown',
      commit: commitMsg,
    });
    if (count) console.log(`[LEDGER] Added ${count} completed task entr${count === 1 ? 'y' : 'ies'}.`);
  } catch { /* ledger is reporting only; release should still complete */ }

  console.log('[LOCK RELEASED & COMMITTED]');
}

// Gate A: agents must not compound on unverified commits. The verify command
// is human-configured in .nexus/config.json (release.verifyCommand), so
// running it through a shell is config-as-code, not untrusted input.
function runVerifyGate({ config, target, agent, noVerify }) {
  const verifyCommand = config.release?.verifyCommand;
  if (!verifyCommand) return;

  if (noVerify) {
    if (config.autonomy > 0) {
      console.error(`[ERROR] --no-verify is only allowed at autonomy level 0 (current: ${config.autonomy}).`);
      console.error('Fix the failure or ask the human to lower the autonomy level.');
      appendStandupLine(config, `${standupTimestamp()} ${agent} [BLOCKED]: release ${target} attempted --no-verify at autonomy ${config.autonomy} — refused`);
      process.exit(1);
    }
    console.warn(`[VERIFY SKIPPED] --no-verify used for ${target} — logged to standup.`);
    appendStandupLine(config, `${standupTimestamp()} ${agent} [WARN]: release ${target} committed with --no-verify (verify command not run)`);
    return;
  }

  console.log(`[VERIFY] Running: ${verifyCommand}`);
  const result = spawnSync(verifyCommand, {
    shell: true, cwd: config.root, encoding: 'utf-8', stdio: 'pipe',
  });

  if (result.status === 0) {
    console.log('[VERIFY OK]');
    return;
  }

  console.error(`[VERIFY FAILED] ${verifyCommand} exited with ${result.status ?? 'no status'}. Release refused; your claim on ${target} is kept.`);
  console.error('Fix the failure and release again. Last output:');
  console.error(tailLines(`${result.stdout || ''}\n${result.stderr || ''}`, 12));
  appendStandupLine(config, `${standupTimestamp()} ${agent} [BLOCKED]: release ${target} refused — verify failed (${verifyCommand})`);
  process.exit(1);
}

function printPendingChanges(root, target, pendingStatus) {
  const diffstat = spawnSync('git', ['diff', '--stat', 'HEAD', '--', target], {
    cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
  });
  const stat = diffstat.status === 0 ? (diffstat.stdout || '').trimEnd() : '';
  if (stat) console.log(stat.split('\n').map((line) => `  ${line.trim()}`).join('\n'));

  // diff --stat misses untracked files; porcelain '??' lines cover them.
  const untracked = pendingStatus.split('\n').filter((line) => line.startsWith('??'));
  for (const line of untracked) {
    console.log(`  ${line.slice(3).trim()} (untracked)`);
  }
}

function appendStandupLine(config, line) {
  try {
    appendFileSync(config.standup, `${line}\n`, 'utf-8');
  } catch { /* standup file might not exist yet; the refusal itself still stands */ }
}

function tailLines(text, count) {
  const lines = text.split('\n').map((line) => line.trimEnd()).filter(Boolean);
  return lines.slice(-count).map((line) => `  ${line}`).join('\n');
}

function standupTimestamp() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rawHour = date.getHours();
  const hour = String(rawHour % 12 || 12).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const period = rawHour < 12 ? 'AM' : 'PM';
  return `${yyyy}-${mm}-${dd} ${hour}:${minute} ${period}`;
}

function shortSha(sha) {
  return sha === 'unknown' ? sha : sha.slice(0, 7);
}

function formatReportTimestamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rawHour = date.getHours();
  const hour = rawHour % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const period = rawHour < 12 ? 'AM' : 'PM';
  return `${yyyy}-${mm}-${dd} ${String(hour).padStart(2, '0')}:${minute}:${second} ${period}`;
}
